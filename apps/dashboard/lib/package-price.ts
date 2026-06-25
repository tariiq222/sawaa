/**
 * Session package price math — Sawaa Dashboard
 *
 * Pure (no Prisma, no React) mirror of the backend's
 * `ComputePackagePriceService` for the **client-side live preview only**.
 * The server is the source of truth on save / list / get — this file exists
 * so the form can show a live subtotal / discount / final-price strip as
 * the user edits items and the discount.
 *
 * Rules (matching `apps/backend/src/modules/org-experience/compute-package-price.service.ts`):
 *   - subtotal = Σ(paidQuantity × unitPrice)              (free items contribute 0)
 *   - PERCENTAGE → discountAmount = floor(subtotal × pct / 100), capped at subtotal
 *   - FIXED      → discountAmount = min(discountValue, subtotal)
 *   - finalPrice = max(0, subtotal − discountAmount)
 *
 * Money is integer halalas end-to-end. Inputs may arrive as strings
 * (Prisma Decimal serializes as `"16000"`); coerce with `Number()` so an
 * `a + b` reduce does not concatenate to `"1600016000"`.
 */

import type {
  PackageDiscountType,
  PackagePriceBreakdown,
} from "./types/package"

const roundHalalas = (n: number) => Math.round(n)

/**
 * Apply the package-level discount to a halalas subtotal.
 * Exposed separately so it is unit-testable without the per-item math.
 */
export function applyPackageDiscount(
  subtotal: number,
  discountType: PackageDiscountType,
  discountValue: number,
): { discountAmount: number; finalPrice: number } {
  let discountAmount: number
  if (discountType === "PERCENTAGE") {
    const safePct = Math.max(0, Math.min(discountValue, 100))
    discountAmount = Math.floor((subtotal * safePct) / 100)
  } else {
    // FIXED — already in integer halalas; clamp to subtotal.
    discountAmount = Math.max(0, Math.min(discountValue, subtotal))
  }
  // Hard cap so an overshoot from either branch can never push finalPrice negative.
  discountAmount = Math.min(discountAmount, subtotal)
  const finalPrice = Math.max(0, subtotal - discountAmount)
  return { discountAmount, finalPrice }
}

export interface PackageItemPriceInput {
  /** Integer halalas. May be a string (Prisma Decimal wire format) — coerced via Number(). */
  unitPrice: number | string
  paidQuantity: number
  freeQuantity?: number
}

/**
 * Compute the package price breakdown for a set of items + a discount.
 *
 * - Items with `paidQuantity = 0` resolve a unit price (so the UI can show
 *   "free with purchase") but contribute 0 to the subtotal — matching
 *   `ComputePackagePriceService.compute`.
 * - Each `unitPrice` is coerced through `Number()` to defeat the Prisma
 *   Decimal string-serialization footgun.
 */
export function computePackagePrice(
  items: PackageItemPriceInput[],
  discountType: PackageDiscountType,
  discountValue: number,
): PackagePriceBreakdown {
  const subtotal = roundHalalas(
    items.reduce((acc, i) => acc + i.paidQuantity * Number(i.unitPrice), 0),
  )
  const { discountAmount, finalPrice } = applyPackageDiscount(
    subtotal,
    discountType,
    discountValue,
  )
  return { subtotal, discountAmount, finalPrice }
}
