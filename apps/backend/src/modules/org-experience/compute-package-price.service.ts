import { Injectable } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database';

/**
 * Input shape per session-package item, narrowed to the columns the pricing
 * service needs to resolve a unit price. serviceId/employeeId/durationOptionId
 * are plain cross-BC strings (no Prisma FK), matching the SessionPackageItem
 * schema convention.
 */
export type PackageItemInput = {
  durationOptionId: string;
  employeeId: string;
  serviceId: string;
  paidQuantity: number;
  freeQuantity: number;
};

/**
 * Discount input is interpreted differently by type:
 *   PERCENTAGE → discountValue is a 0-100 percentage (e.g. 10 = 10%)
 *   FIXED      → discountValue is an integer-halalas amount (e.g. 5000 = 50 SAR)
 *
 * The CreateSessionPackage handler converts the dashboard's SAR-float discount
 * to halalas (FIXED) or passes the percentage through (PERCENTAGE) before
 * calling this service, so this method never has to interpret the input scale.
 */
export type PackageDiscountInput = {
  discountType: DiscountType;
  discountValue: number;
};

export type ComputePackagePriceParams = {
  items: PackageItemInput[];
} & PackageDiscountInput;

export type PackagePriceResult = {
  subtotal: number; // integer halalas
  discountAmount: number; // integer halalas
  finalPrice: number; // integer halalas = max(0, subtotal − discountAmount)
  itemUnitPrices: { durationOptionId: string; unitPrice: number }[];
};

/**
 * Cluster-root pricing helper for session packages.
 *
 * Used by the Create/Update handlers to compute the canonical package price
 * (subtotal / discount / final) for display in the catalog and as a sanity
 * check on the user-supplied discountValue before persisting.
 *
 * Resolution priority for `unitPrice` (per item):
 *   1. EmployeeServiceOption.priceOverride (when row exists AND priceOverride is non-null)
 *   2. ServiceDurationOption.price (fallback)
 *
 * Math rules (mirroring the old BundlePriceService):
 *   PERCENTAGE → discountAmount = floor(subtotal × discountValue / 100), capped at subtotal
 *   FIXED      → discountAmount = min(discountValue, subtotal)
 *   finalPrice = max(0, subtotal − discountAmount)
 *
 * Free-only items (paidQuantity = 0) resolve a unit price (so the catalog UI
 * can show "free with purchase") but contribute 0 to subtotal.
 */
@Injectable()
export class ComputePackagePriceService {
  constructor(private readonly prisma: PrismaService) {}

  async compute(params: ComputePackagePriceParams): Promise<PackagePriceResult> {
    const itemUnitPrices: { durationOptionId: string; unitPrice: number }[] = [];
    let subtotal = 0;

    for (const item of params.items) {
      const unitPrice = await this.resolveUnitPrice(item);
      itemUnitPrices.push({ durationOptionId: item.durationOptionId, unitPrice });
      subtotal += item.paidQuantity * unitPrice;
    }

    const { discountAmount, finalPrice } = ComputePackagePriceService.applyDiscount(
      subtotal,
      params.discountType,
      params.discountValue,
    );

    return { subtotal, discountAmount, finalPrice, itemUnitPrices };
  }

  /**
   * Pure helper exposed for direct unit testing — compute()'s orchestration
   * delegates here so the discount math is testable without Prisma.
   */
  static applyDiscount(
    subtotal: number,
    discountType: DiscountType,
    discountValue: number,
  ): { discountAmount: number; finalPrice: number } {
    let discountAmount: number;
    if (discountType === DiscountType.PERCENTAGE) {
      const safePct = Math.max(0, Math.min(discountValue, 100));
      discountAmount = Math.floor((subtotal * safePct) / 100);
    } else {
      // FIXED
      discountAmount = Math.max(0, Math.min(discountValue, subtotal));
    }
    // Hard cap at subtotal so an overshoot from either branch can never push finalPrice negative.
    discountAmount = Math.min(discountAmount, subtotal);
    const finalPrice = Math.max(0, subtotal - discountAmount);
    return { discountAmount, finalPrice };
  }

  private async resolveUnitPrice(item: PackageItemInput): Promise<number> {
    const employeeService = await this.prisma.employeeService.findFirst({
      where: { employeeId: item.employeeId, serviceId: item.serviceId, isActive: true },
      select: { id: true },
    });
    if (!employeeService) {
      throw new Error(
        `No active employee service link for employeeId=${item.employeeId}, serviceId=${item.serviceId}`,
      );
    }

    // EmployeeServiceOption.priceOverride (may be null) — only used when explicitly set.
    const override = await this.prisma.employeeServiceOption.findFirst({
      where: {
        employeeServiceId: employeeService.id,
        durationOptionId: item.durationOptionId,
        isActive: true,
      },
      select: { priceOverride: true },
    });
    if (override && override.priceOverride !== null && override.priceOverride !== undefined) {
      return this.toHalalas(override.priceOverride);
    }

    // Fallback: the service-default duration-option price.
    const durationOption = await this.prisma.serviceDurationOption.findFirst({
      where: { id: item.durationOptionId },
      select: { price: true },
    });
    if (!durationOption) {
      throw new Error(`ServiceDurationOption not found for durationOptionId=${item.durationOptionId}`);
    }
    return this.toHalalas(durationOption.price);
  }

  /** Decimal(12,2) stores integer halalas but returns Prisma.Decimal; coerce defensively. */
  private toHalalas(value: Prisma.Decimal | string | number): number {
    return Math.round(Number(value.toString()));
  }
}