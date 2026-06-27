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

/** Resolves an item's per-session unit price (integer halalas). Throws when the
 *  item references a missing active link / duration option — same failure
 *  surface as the legacy per-item lookup. */
type UnitPriceResolver = (item: PackageItemInput) => number;

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
 *
 * Query strategy: a single package resolves its unit prices in THREE bulk
 * lookups (not 3-per-item), and `computeMany` resolves an arbitrary number of
 * packages in the SAME three bulk lookups — so the public catalog / dashboard
 * package list stay O(1) round-trips regardless of catalog size (P1-4).
 */
@Injectable()
export class ComputePackagePriceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Price a single package. Resolves its items' unit prices in 3 bulk queries. */
  async compute(params: ComputePackagePriceParams): Promise<PackagePriceResult> {
    const resolver = await this.buildUnitPriceResolver(params.items);
    return ComputePackagePriceService.priceItems(params.items, resolver);
  }

  /**
   * Price many packages in ONE set of three bulk lookups. The per-package result
   * is identical to calling `compute` on each group — only the query count
   * collapses from `3 × Σ items` round-trips to a constant 3. Use this from the
   * list/catalog handlers instead of `Promise.all(groups.map(compute))`.
   */
  async computeMany(
    itemGroups: PackageItemInput[][],
  ): Promise<PackagePriceResult[]> {
    const allItems = itemGroups.flat();
    const resolver = await this.buildUnitPriceResolver(allItems);
    return itemGroups.map((items) =>
      ComputePackagePriceService.priceItems(items, resolver),
    );
  }

  /** Pure per-item math over a unit-price resolver — no I/O. */
  private static priceItems(
    items: PackageItemInput[],
    unitPriceOf: UnitPriceResolver,
  ): PackagePriceResult {
    const itemUnitPrices: { durationOptionId: string; unitPrice: number }[] = [];
    const lines: PackageLinePrice[] = [];
    let subtotal = 0;
    let discountAmount = 0;
    let fullValue = 0;
    let freeValue = 0;

    for (const item of items) {
      const unitPrice = unitPriceOf(item);
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

  /**
   * Resolve unit prices for a set of items in three bulk lookups, returning a
   * pure resolver. Resolution priority per item (unchanged):
   *   1. EmployeeServiceOption.priceOverride (active row, non-null override)
   *   2. ServiceDurationOption.price (fallback)
   * The resolver throws on a missing active link / duration — the SAME failure
   * the legacy per-item path raised, just deferred to price-time.
   */
  private async buildUnitPriceResolver(
    items: PackageItemInput[],
  ): Promise<UnitPriceResolver> {
    if (items.length === 0) {
      return () => {
        throw new Error('No items to price');
      };
    }

    const employeeIds = [...new Set(items.map((i) => i.employeeId))];
    const serviceIds = [...new Set(items.map((i) => i.serviceId))];
    const durationOptionIds = [...new Set(items.map((i) => i.durationOptionId))];

    // 1. Active EmployeeService links → map `${employeeId}:${serviceId}` → id.
    const links = await this.prisma.employeeService.findMany({
      where: {
        employeeId: { in: employeeIds },
        serviceId: { in: serviceIds },
        isActive: true,
      },
      select: { id: true, employeeId: true, serviceId: true },
    });
    const linkMap = new Map(
      links.map((l) => [`${l.employeeId}:${l.serviceId}`, l.id]),
    );

    // 2. Active EmployeeServiceOption overrides for those links + durations →
    //    map `${employeeServiceId}:${durationOptionId}` → priceOverride.
    const employeeServiceIds = [...new Set(links.map((l) => l.id))];
    const overrides =
      employeeServiceIds.length > 0
        ? await this.prisma.employeeServiceOption.findMany({
            where: {
              employeeServiceId: { in: employeeServiceIds },
              durationOptionId: { in: durationOptionIds },
              isActive: true,
            },
            select: {
              employeeServiceId: true,
              durationOptionId: true,
              priceOverride: true,
            },
          })
        : [];
    const overrideMap = new Map(
      overrides.map((o) => [
        `${o.employeeServiceId}:${o.durationOptionId}`,
        o.priceOverride,
      ]),
    );

    // 3. Service-default duration-option prices → map id → price.
    const durationOptions = await this.prisma.serviceDurationOption.findMany({
      where: { id: { in: durationOptionIds } },
      select: { id: true, price: true },
    });
    const durationMap = new Map(durationOptions.map((d) => [d.id, d.price]));

    return (item: PackageItemInput): number => {
      const employeeServiceId = linkMap.get(`${item.employeeId}:${item.serviceId}`);
      if (!employeeServiceId) {
        throw new Error(
          `No active employee service link for employeeId=${item.employeeId}, serviceId=${item.serviceId}`,
        );
      }
      const override = overrideMap.get(`${employeeServiceId}:${item.durationOptionId}`);
      if (override !== null && override !== undefined) {
        return this.toHalalas(override);
      }
      const price = durationMap.get(item.durationOptionId);
      if (price === null || price === undefined) {
        throw new Error(
          `ServiceDurationOption not found for durationOptionId=${item.durationOptionId}`,
        );
      }
      return this.toHalalas(price);
    };
  }

  /** Decimal(12,2) stores integer halalas but returns Prisma.Decimal; coerce defensively. */
  private toHalalas(value: Prisma.Decimal | string | number): number {
    return Math.round(Number(value.toString()));
  }
}
