import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, DiscountType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { toHalalas } from '../../../finance/money.helper';
import { UpdateSessionPackageDto } from './update-session-package.dto';
import { CreateSessionPackageItemDto } from '../create-session-package/create-session-package.dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';

export type UpdateSessionPackageCommand = UpdateSessionPackageDto & { packageId: string };

const ITEM_QUANTITY_MESSAGE = 'Each item must have at least one session (paidQuantity + freeQuantity >= 1)';

/**
 * Update an existing SessionPackage.
 *
 *   - 404 if the package is missing or already archived.
 *   - If `items` is provided, validate every row (employee-service link,
 *     duration option → service match, paid+free ≥ 1) and replace the
 *     item set atomically inside a transaction (delete + createMany).
 *   - If `discountType` and/or `discountValue` is provided, re-run the
 *     pricing service against the effective items (new if provided, else
 *     the existing persisted items) and validate the discount range.
 *   - Only changed fields are forwarded to Prisma.update.
 */
@Injectable()
export class UpdateSessionPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  async execute(dto: UpdateSessionPackageCommand) {
    const existing = await this.prisma.sessionPackage.findFirst({
      where: { id: dto.packageId, archivedAt: null },
      include: { items: true },
    });
    if (!existing) {
      throw new NotFoundException('Session package not found');
    }

    const itemsProvided = dto.items !== undefined;

    // 1. Validate items + their per-item discounts when a new set is provided.
    if (itemsProvided) {
      this.validateItemQuantities(dto.items!);
      await this.validateItemReferences(dto.items!);

      const price = await this.pricing.compute({
        items: dto.items!.map((i) => ({
          durationOptionId: i.durationOptionId,
          employeeId: i.employeeId,
          serviceId: i.serviceId,
          paidQuantity: i.paidQuantity,
          freeQuantity: i.freeQuantity ?? 0,
          discountType: i.discountType ?? null,
          discountValue: this.normalizeItemDiscountValue(i.discountType, i.discountValue),
        })),
      });
      this.validateItemDiscounts(dto.items!, price.lines);
    }

    // 2. Apply the update atomically: replace items if provided, then patch fields.
    //    Package-level discount is deprecated and never written here.
    return this.rlsTransaction.withTransaction(async (tx) => {
      if (itemsProvided) {
        await tx.sessionPackageItem.deleteMany({ where: { packageId: dto.packageId } });
        await tx.sessionPackageItem.createMany({
          data: dto.items!.map((item, idx) => ({
            packageId: dto.packageId,
            serviceId: item.serviceId,
            employeeId: item.employeeId,
            durationOptionId: item.durationOptionId,
            paidQuantity: item.paidQuantity,
            freeQuantity: item.freeQuantity ?? 0,
            discountType: item.discountType ?? null,
            discountValue: this.normalizeItemDiscountValue(
              item.discountType,
              item.discountValue,
            ) as unknown as Prisma.Decimal,
            sortOrder: item.sortOrder ?? idx,
          })),
        });
      }

      return tx.sessionPackage.update({
        where: { id: dto.packageId },
        data: {
          ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
          ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
          ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
          ...(dto.descriptionEn !== undefined && { descriptionEn: dto.descriptionEn }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.iconName !== undefined && { iconName: dto.iconName }),
          ...(dto.iconBgColor !== undefined && { iconBgColor: dto.iconBgColor }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.isPublic !== undefined && { isPublic: dto.isPublic }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
        include: { items: true },
      });
    });
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private validateItemQuantities(items: CreateSessionPackageItemDto[]): void {
    const bad = items.findIndex((i) => (i.paidQuantity ?? 0) + (i.freeQuantity ?? 0) < 1);
    if (bad !== -1) throw new BadRequestException(ITEM_QUANTITY_MESSAGE);
  }

  private async validateItemReferences(items: CreateSessionPackageItemDto[]): Promise<void> {
    const employeeServiceLinks = await this.prisma.employeeService.findMany({
      where: {
        isActive: true,
        OR: items.map((i) => ({ employeeId: i.employeeId, serviceId: i.serviceId })),
      },
      select: { employeeId: true, serviceId: true },
    });
    const linkKey = (e: string, s: string) => `${e}::${s}`;
    const validLinks = new Set(employeeServiceLinks.map((l) => linkKey(l.employeeId, l.serviceId)));
    const missingLink = items.find((i) => !validLinks.has(linkKey(i.employeeId, i.serviceId)));
    if (missingLink) {
      throw new BadRequestException('Employee does not provide this service');
    }

    const durationOptions = await this.prisma.serviceDurationOption.findMany({
      where: { id: { in: items.map((i) => i.durationOptionId) }, isActive: true },
      select: { id: true, serviceId: true },
    });
    const optionToService = new Map(durationOptions.map((o) => [o.id, o.serviceId]));
    const mismatched = items.find((i) => optionToService.get(i.durationOptionId) !== i.serviceId);
    if (mismatched) {
      throw new BadRequestException('Duration option not found for this service');
    }
  }

  private normalizeItemDiscountValue(
    discountType: DiscountType | null | undefined,
    rawValue: number | undefined,
  ): number {
    if (!discountType || !rawValue) return 0;
    if (discountType === DiscountType.PERCENTAGE) return rawValue;
    return toHalalas(rawValue).toNumber();
  }

  private validateItemDiscounts(
    items: CreateSessionPackageItemDto[],
    lines: { payable: number }[],
  ): void {
    items.forEach((item, i) => {
      if (!item.discountType || !item.discountValue) return;
      if (item.discountType === DiscountType.PERCENTAGE) {
        if (item.discountValue < 0 || item.discountValue > 100) {
          throw new BadRequestException('PERCENTAGE discountValue must be between 0 and 100');
        }
        return;
      }
      const discountHalalas = toHalalas(item.discountValue).toNumber();
      if (discountHalalas > (lines[i]?.payable ?? 0)) {
        throw new BadRequestException("FIXED discountValue must not exceed the item's payable amount");
      }
    });
  }
}