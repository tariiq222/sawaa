/**
 * Session package price math — Sawaa Dashboard
 *
 * Pure (no Prisma, no React) mirror of the backend's
 * `ComputePackagePriceService` for the **client-side live preview only**.
 * The server is the source of truth on save / list / get — this file exists
 * so the form can show a live per-item + total breakdown as the user edits.
 *
 * Model (per item — matching
 * `apps/backend/src/modules/org-experience/compute-package-price.service.ts`):
 *   - payable   = paidQuantity × unitPrice            (free sessions excluded)
 *   - fullValue = (paid + free) × unitPrice           (true value / cost)
 *   - freeValue = freeQuantity × unitPrice            (value given for free)
 *   - discount  = applyItemDiscount(payable, type, value)   (PERCENTAGE 0-100 | FIXED halalas)
 *   - net       = payable − discount                  (what the client pays)
 * Totals: subtotal = Σ payable, discountAmount = Σ discount,
 *         finalPrice = subtotal − discountAmount, savings = freeValue + discount.
 *
 * Money is integer halalas end-to-end. Inputs may arrive as strings
 * (Prisma Decimal serializes as `"16000"`); coerce with `Number()`.
 */

import type {
  PackageDiscountType,
  PackageLineBreakdown,
  PackagePriceBreakdown,
} from "./types/package"

const roundHalalas = (n: number) => Math.round(n)

/**
 * Apply a single discount to a halalas base amount. A null type or zero value
 * yields no discount. Mirrors the backend `applyDiscount`.
 */
export function applyItemDiscount(
  base: number,
  discountType: PackageDiscountType | null | undefined,
  discountValue: number,
): number {
  if (!discountType || !discountValue) return 0
  let discountAmount: number
  if (discountType === "PERCENTAGE") {
    const safePct = Math.max(0, Math.min(discountValue, 100))
    discountAmount = Math.floor((base * safePct) / 100)
  } else {
    // FIXED — already in integer halalas; clamp to base.
    discountAmount = Math.max(0, Math.min(discountValue, base))
  }
  return Math.min(discountAmount, base)
}

export interface PackageItemPriceInput {
  /** Integer halalas. May be a string (Prisma Decimal wire format) — coerced via Number(). */
  unitPrice: number | string
  paidQuantity: number
  freeQuantity?: number
  discountType?: PackageDiscountType | null
  /** PERCENTAGE: 0-100. FIXED: integer halalas. */
  discountValue?: number
}

/**
 * Compute the package price breakdown (per-line + totals) for a set of items.
 * Items with `paidQuantity = 0` still resolve their free value but contribute
 * 0 to the subtotal — matching `ComputePackagePriceService.compute`.
 */
export function computePackagePrice(items: PackageItemPriceInput[]): PackagePriceBreakdown {
  const lines: PackageLineBreakdown[] = items.map((i) => {
    const unit = Number(i.unitPrice)
    const free = i.freeQuantity ?? 0
    const payable = roundHalalas(i.paidQuantity * unit)
    const fullValue = roundHalalas((i.paidQuantity + free) * unit)
    const freeValue = roundHalalas(free * unit)
    const discountAmount = applyItemDiscount(payable, i.discountType, i.discountValue ?? 0)
    const net = Math.max(0, payable - discountAmount)
    return { fullValue, freeValue, payable, discountAmount, net }
  })

  const subtotal = lines.reduce((a, l) => a + l.payable, 0)
  const discountAmount = lines.reduce((a, l) => a + l.discountAmount, 0)
  const fullValue = lines.reduce((a, l) => a + l.fullValue, 0)
  const freeValue = lines.reduce((a, l) => a + l.freeValue, 0)
  const finalPrice = Math.max(0, subtotal - discountAmount)

  return {
    subtotal,
    discountAmount,
    finalPrice,
    fullValue,
    freeValue,
    totalSavings: freeValue + discountAmount,
    lines,
  }
}
