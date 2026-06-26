import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { DiscountType, Prisma } from '@prisma/client';
import { toHalalas } from '../../../finance/money.helper';
import { CreateSessionPackageDto } from './create-session-package.dto';
import { ComputePackagePriceService } from '../../compute-package-price.service';

export type CreateSessionPackageCommand = CreateSessionPackageDto;

const ITEM_QUANTITY_MESSAGE = 'Each item must have at least one session (paidQuantity + freeQuantity >= 1)';

/**
 * Create a new SessionPackage + its items atomically.
 *
 * Validation pipeline (each step fails fast with 400 + Arabic error):
 *  1. Each item's `EmployeeService` link must exist (employee offers service).
 *  2. Each item's `ServiceDurationOption` must belong to the same serviceId.
 *  3. Each item must have paidQuantity + freeQuantity >= 1 (catches {0,0} bug).
 *  4. discountValue range: PERCENTAGE → [0,100]; FIXED → ≤ computed subtotal.
 *  5. Compute final price with the shared pricing service (sanity check + UI preview).
 *  6. Convert FIXED discountValue from SAR float to integer halalas via toHalalas.
 *  7. Persist package + items inside a single transaction (RLS-scoped).
 */
@Injectable()
export class CreateSessionPackageHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly pricing: ComputePackagePriceService,
  ) {}

  async execute(dto: CreateSessionPackageCommand) {
    await this.validateItems(dto.items);

    // Compute per-item prices (discount lives on each item now) and validate
    // every item's discount against its own payable amount.
    const price = await this.pricing.compute({
      items: dto.items.map((i) => ({
        durationOptionId: i.durationOptionId,
        employeeId: i.employeeId,
        serviceId: i.serviceId,
        paidQuantity: i.paidQuantity,
        freeQuantity: i.freeQuantity ?? 0,
        discountType: i.discountType ?? null,
        discountValue: this.normalizeItemDiscountValue(i.discountType, i.discountValue),
      })),
    });
    this.validateItemDiscounts(dto.items, price.lines);

    const created = await this.rlsTransaction.withTransaction((tx) =>
      tx.sessionPackage.create({
        data: {
          nameAr: dto.nameAr,
          nameEn: dto.nameEn ?? null,
          descriptionAr: dto.descriptionAr ?? null,
          descriptionEn: dto.descriptionEn ?? null,
          imageUrl: dto.imageUrl ?? null,
          iconName: dto.iconName ?? null,
          iconBgColor: dto.iconBgColor ?? null,
          // Package-level discount is deprecated — store a neutral value.
          // The effective discount now lives on each item.
          discountType: DiscountType.PERCENTAGE,
          discountValue: 0 as unknown as Prisma.Decimal,
          isActive: dto.isActive ?? true,
          isPublic: dto.isPublic ?? false,
          sortOrder: dto.sortOrder ?? 0,
          items: {
            createMany: {
              data: dto.items.map((item, idx) => ({
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
            },
          },
        },
        include: { items: true },
      }),
    );

    return created;
  }

  private async validateItems(items: CreateSessionPackageDto['items']): Promise<void> {
    // 1. Every item must have at least one session (paid + free >= 1).
    const emptyItem = items.findIndex((i) => (i.paidQuantity ?? 0) + (i.freeQuantity ?? 0) < 1);
    if (emptyItem !== -1) {
      throw new BadRequestException(ITEM_QUANTITY_MESSAGE);
    }

    // 2. EmployeeService link must exist (the practitioner offers this service).
    const employeeServiceIds = await this.prisma.employeeService.findMany({
      where: {
        isActive: true,
        OR: items.map((i) => ({ employeeId: i.employeeId, serviceId: i.serviceId })),
      },
      select: { employeeId: true, serviceId: true },
    });
    const linkKey = (e: string, s: string) => `${e}::${s}`;
    const validLinks = new Set(employeeServiceIds.map((l) => linkKey(l.employeeId, l.serviceId)));
    const missingLink = items.find((i) => !validLinks.has(linkKey(i.employeeId, i.serviceId)));
    if (missingLink) {
      throw new BadRequestException('Employee does not provide this service');
    }

    // 3. Each durationOptionId must belong to the item's serviceId and be active.
    const durationOptionIds = items.map((i) => i.durationOptionId);
    const durationOptions = await this.prisma.serviceDurationOption.findMany({
      where: { id: { in: durationOptionIds }, isActive: true },
      select: { id: true, serviceId: true },
    });
    const optionToService = new Map(durationOptions.map((o) => [o.id, o.serviceId]));
    const mismatched = items.find((i) => optionToService.get(i.durationOptionId) !== i.serviceId);
    if (mismatched) {
      throw new BadRequestException('Duration option not found for this service');
    }
  }

  /**
   * Returns the value to persist on `SessionPackageItem.discountValue`.
   *   - no type → 0
   *   - PERCENTAGE → rawValue as-is (0-100)
   *   - FIXED      → rawValue rounded to integer halalas
   */
  private normalizeItemDiscountValue(
    discountType: DiscountType | null | undefined,
    rawValue: number | undefined,
  ): number {
    if (!discountType || !rawValue) return 0;
    if (discountType === DiscountType.PERCENTAGE) return rawValue;
    return toHalalas(rawValue).toNumber();
  }

  /**
   * Per-item discount validation against the computed lines (same order as items):
   *   PERCENTAGE → reject values outside [0,100].
   *   FIXED      → reject halalas amounts that exceed the item's payable (paid × unit).
   */
  private validateItemDiscounts(
    items: CreateSessionPackageDto['items'],
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