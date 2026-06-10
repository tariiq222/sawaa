/**
 * Money helpers — single source of truth for halalas ↔ SAR conversion.
 *
 * Backend convention: monetary amounts are stored as integers in halalas
 * (1 SAR = 100 halalas). Use these helpers everywhere instead of ad-hoc
 * `/100` divisions.
 */

/** Convert SAR (decimal) to halalas (integer). 99.5 SAR → 9950 */
export function sarToHalalas(sar: number): number {
  return Math.round(sar * 100)
}

/** Convert halalas (integer) to SAR formatted string (2 decimal places). 9950 → "99.50" */
export function halalasToSar(halalas: number): string {
  return (halalas / 100).toFixed(2)
}

/** Convert halalas (integer) to SAR as a number. 9950 → 99.5 */
export function halalasToSarNumber(halalas: number): number {
  return halalas / 100
}

/**
 * Compute the VAT-inclusive (gross) amount in halalas from a net amount.
 *
 * Mirrors the backend invoice math (apps/backend/src/modules/finance/money.helper.ts
 * `computeVat`): vatAmt = round_half_up(net × vatRate); gross = net + vatAmt.
 * For positive amounts `Math.round` is round-half-up, so this stays in parity
 * with what the backend actually charges.
 *
 * @param halalas net amount in integer halalas
 * @param vatRate fractional rate, e.g. 0.15 = 15% (NOT a percentage)
 */
export function grossWithVat(halalas: number, vatRate: number): number {
  return halalas + Math.round(halalas * vatRate)
}
