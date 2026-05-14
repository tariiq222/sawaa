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
