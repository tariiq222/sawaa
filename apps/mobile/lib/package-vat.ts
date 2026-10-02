/**
 * VAT helpers for package prices. Option prices on the public package API are
 * NET integer halalas; the family carries the centre's `vatRate` as a fraction.
 * The invoice and the Moyasar charge are
 * `net + round_half_up(net × vatRate)`, matching the backend `computeVat`.
 */

/** Reads a family's VAT rate. Missing, invalid or negative values are 0. */
export function packageVatRate(family: { vatRate?: number | null } | null | undefined): number {
  const rate = family?.vatRate;
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** VAT on a net halala amount: round_half_up(net × rate), in whole halalas. */
export function packageVatHalalas(netHalalas: number, vatRate: number): number {
  if (!Number.isFinite(netHalalas) || netHalalas <= 0 || !Number.isFinite(vatRate) || vatRate <= 0) return 0;
  // Trim float noise (e.g. 5400.000000000001) before rounding half up.
  const product = Number((netHalalas * vatRate).toFixed(6));
  return Math.floor(product + 0.5);
}

/** VAT-inclusive amount the client pays for a net package price. */
export function packageGrossHalalas(netHalalas: number, vatRate: number): number {
  return netHalalas + packageVatHalalas(netHalalas, vatRate);
}

/** Amount actually charged for a purchase row (VAT-inclusive when reported). */
export function purchaseChargedHalalas(purchase: { amountPaid: number; totalCharged?: number | null }): number {
  return typeof purchase.totalCharged === 'number' && Number.isFinite(purchase.totalCharged)
    ? purchase.totalCharged
    : purchase.amountPaid;
}
