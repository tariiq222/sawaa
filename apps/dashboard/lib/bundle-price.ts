import type { BundleDiscountType, BundlePriceBreakdown } from "./types/bundle"

// Money is integer halalas — round to whole halalas (mirrors the backend
// BundlePriceService.roundHalalas).
const roundHalalas = (n: number) => Math.round(n)

/**
 * Compute a bundle's price breakdown. Operates entirely in integer halalas.
 *
 * - `servicePrices` are halalas, so `subtotal` is halalas.
 * - For `FIXED`, `discountValue` is a money amount in halalas.
 * - For `PERCENTAGE`, `discountValue` is a raw 0-100 percent; the `/ 100`
 *   below is the percentage divisor, not a unit conversion.
 */
export function computeBundlePrice(
  servicePrices: number[],
  discountType: BundleDiscountType,
  discountValue: number,
): BundlePriceBreakdown {
  // Coerce each price: the backend serializes Prisma Decimal halalas as a
  // string, so a bare `a + b` would concatenate instead of sum.
  const subtotal = roundHalalas(servicePrices.reduce((a, b) => a + Number(b), 0))
  let discountAmount = 0
  if (discountType === 'PERCENTAGE') {
    discountAmount = roundHalalas(subtotal * Math.min(discountValue, 100) / 100)
  } else {
    discountAmount = roundHalalas(Math.min(discountValue, subtotal))
  }
  const finalPrice = roundHalalas(Math.max(0, subtotal - discountAmount))
  return { subtotal, discountAmount, finalPrice }
}
