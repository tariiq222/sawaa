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

    const storedDiscountValue = this.normalizeDiscountValue(dto.discountType, dto.discountValue);

    // Run the pricing service BEFORE writing to make sure the discount is
    // mathematically consistent with the subtotal (FIXED ≤ subtotal guard).
    const pricePreview = await this.pricing.compute({
      items: dto.items.map((i) => ({
        durationOptionId: i.durationOptionId,
        employeeId: i.employeeId,
        serviceId: i.serviceId,
        paidQuantity: i.paidQuantity,
        freeQuantity: i.freeQuantity ?? 0,
      })),
      discountType: dto.discountType,
      discountValue: storedDiscountValue,
    });

    this.validateDiscount(dto.discountType, dto.discountValue, pricePreview.subtotal);

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
          discountType: dto.discountType,
          // Stored as Decimal(12,2). For PERCENTAGE we keep the percentage
          // value as-is (e.g. 10 = 10%); for FIXED we convert SAR → halalas.
          discountValue: storedDiscountValue as unknown as Prisma.Decimal,
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
   * Returns the value to persist on `SessionPackage.discountValue` (a Decimal(12,2)).
   *   - PERCENTAGE → dto.discountValue (0-100, kept as the percentage itself)
   *   - FIXED      → dto.discountValue as-is (already in integer halalas per the
   *                  rest-of-codebase convention; `toHalalas` only rounds to
   *                  0-dp for safety against non-integer input)
   */
  private normalizeDiscountValue(discountType: DiscountType, rawValue: number): number {
    if (discountType === DiscountType.PERCENTAGE) {
      return rawValue;
    }
    // FIXED — already in integer halalas; round defensively.
    return toHalalas(rawValue).toNumber();
  }

  /**
   * PERCENTAGE → reject values outside [0,100].
   * FIXED      → reject halalas values that exceed the computed subtotal.
   */
  private validateDiscount(discountType: DiscountType, rawValue: number, subtotalHalalas: number): void {
    if (discountType === DiscountType.PERCENTAGE) {
      if (rawValue < 0 || rawValue > 100) {
        throw new BadRequestException('PERCENTAGE discountValue must be between 0 and 100');
      }
      return;
    }
    // FIXED — rawValue is in integer halalas; compare directly to the subtotal in halalas.
    const discountHalalas = toHalalas(rawValue).toNumber();
    if (discountHalalas > subtotalHalalas) {
      throw new BadRequestException('FIXED discountValue must not exceed the computed subtotal');
    }
  }
}