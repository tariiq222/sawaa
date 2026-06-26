import { Injectable } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database';

/**
 * Input shape per session-package item, narrowed to the columns the pricing
 * service needs to resolve a unit price. serviceId/employeeId/durationOptionId
 * are plain cross-BC strings (no Prisma FK), matching the SessionPackageItem
 * schema convention.
 */
/**
 * Per-item discount, interpreted by type (mirrors the package-level convention):
 *   PERCENTAGE → discountValue is a 0-100 percentage (e.g. 10 = 10%)
 *   FIXED      → discountValue is an integer-halalas amount (e.g. 5000 = 50 SAR)
 *   null type  → no item discount.
 * The discount applies to the item's PAYABLE amount (paidQuantity × unitPrice).
 */
export type PackageItemInput = {
  durationOptionId: string;
  employeeId: string;
  serviceId: string;
  paidQuantity: number;
  freeQuantity: number;
  discountType?: DiscountType | null;
  discountValue?: number;
};

export type ComputePackagePriceParams = {
  items: PackageItemInput[];
};

/** Per-line price breakdown (all integer halalas) for transparent display. */
export type PackageLinePrice = {
  durationOptionId: string;
  unitPrice: number; // per-session price
  fullValue: number; // (paid + free) × unitPrice — true value / cost
  freeValue: number; // free × unitPrice — value given for free
  payable: number; // paid × unitPrice — before item discount
  discountAmount: number; // item discount on payable
  net: number; // payable − discountAmount — what the client pays for this line
};

export type PackagePriceResult = {
  // ── Payment snapshot fields (meaning unchanged — frozen at purchase) ──
  subtotal: number; // Σ payable (paid × unit) — excludes free sessions
  discountAmount: number; // Σ per-item discount
  finalPrice: number; // max(0, subtotal − discountAmount) — amount charged
  // ── Display-only fields (never persisted to the purchase snapshot) ──
  fullValue: number; // Σ fullValue — total true value incl. free sessions
  freeValue: number; // Σ freeValue — total value of free sessions
  itemUnitPrices: { durationOptionId: string; unitPrice: number }[];
  lines: PackageLinePrice[];
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
    const lines: PackageLinePrice[] = [];
    let subtotal = 0;
    let discountAmount = 0;
    let fullValue = 0;
    let freeValue = 0;

    for (const item of params.items) {
      const unitPrice = await this.resolveUnitPrice(item);
      itemUnitPrices.push({ durationOptionId: item.durationOptionId, unitPrice });

      const payable = item.paidQuantity * unitPrice;
      const lineFull = (item.paidQuantity + item.freeQuantity) * unitPrice;
      const lineFree = item.freeQuantity * unitPrice;
      const lineDiscount = ComputePackagePriceService.applyDiscount(
        payable,
        item.discountType ?? null,
        item.discountValue ?? 0,
      ).discountAmount;
      const net = Math.max(0, payable - lineDiscount);

      subtotal += payable;
      discountAmount += lineDiscount;
      fullValue += lineFull;
      freeValue += lineFree;
      lines.push({
        durationOptionId: item.durationOptionId,
        unitPrice,
        fullValue: lineFull,
        freeValue: lineFree,
        payable,
        discountAmount: lineDiscount,
        net,
      });
    }

    const finalPrice = Math.max(0, subtotal - discountAmount);
    return { subtotal, discountAmount, finalPrice, fullValue, freeValue, itemUnitPrices, lines };
  }

  /**
   * Pure helper exposed for direct unit testing — applies a single discount to a
   * base amount (integer halalas). A null type or zero value yields no discount.
   *   PERCENTAGE → floor(base × pct / 100), pct clamped to [0,100]
   *   FIXED      → min(value, base)
   * The result is hard-capped at `base` so finalPrice can never go negative.
   */
  static applyDiscount(
    base: number,
    discountType: DiscountType | null | undefined,
    discountValue: number,
  ): { discountAmount: number; finalPrice: number } {
    let discountAmount: number;
    if (!discountType || !discountValue) {
      discountAmount = 0;
    } else if (discountType === DiscountType.PERCENTAGE) {
      const safePct = Math.max(0, Math.min(discountValue, 100));
      discountAmount = Math.floor((base * safePct) / 100);
    } else {
      // FIXED
      discountAmount = Math.max(0, Math.min(discountValue, base));
    }
    // Hard cap at base so an overshoot from either branch can never push finalPrice negative.
    discountAmount = Math.min(discountAmount, base);
    const finalPrice = Math.max(0, base - discountAmount);
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