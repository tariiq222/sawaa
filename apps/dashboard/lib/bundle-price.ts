import type { BundleDiscountType, BundlePriceBreakdown } from "./types/bundle"

const round2 = (n: number) => Math.round(n * 100) / 100

export function computeBundlePrice(
  servicePrices: number[],
  discountType: BundleDiscountType,
  discountValue: number,
): BundlePriceBreakdown {
  const subtotal = round2(servicePrices.reduce((a, b) => a + b, 0))
  let discountAmount = 0
  if (discountType === 'PERCENTAGE') {
    discountAmount = round2(subtotal * Math.min(discountValue, 100) / 100)
  } else {
    discountAmount = round2(Math.min(discountValue, subtotal))
  }
  const finalPrice = round2(Math.max(0, subtotal - discountAmount))
  return { subtotal, discountAmount, finalPrice }
}
