/**
 * Money helpers — single source of truth for halalas ↔ SAR conversion.
 *
 * Backend convention: monetary amounts are stored as integers in halalas
 * (1 SAR = 100 halalas). Use these helpers everywhere instead of ad-hoc
 * `/100` divisions so the eventual halalas↔SAR unification migration only
 * has to update one file.
 */

const HALALAS_PER_SAR = 100

/** Convert halalas (integer) to SAR as a number. */
export function halalasToSar(halalas: number | null | undefined): number {
  if (halalas == null || Number.isNaN(halalas)) return 0
  return halalas / HALALAS_PER_SAR
}

/** Alias for halalasToSar — explicitly returns a number. */
export const halalasToSarNumber = halalasToSar

/** Convert SAR to halalas (integer). Rounds to nearest halala. */
export function sarToHalalas(sar: number | null | undefined): number {
  if (sar == null || Number.isNaN(sar)) return 0
  return Math.round(sar * HALALAS_PER_SAR)
}

/**
 * Format an amount stored in halalas as a SAR-denominated numeric string.
 * Does NOT prepend the SAR symbol — pair with `<SarSymbol />` or
 * `<FormattedCurrency />` for full display.
 *
 * @param halalas - amount in halalas (backend convention)
 * @param options.decimals - default 2
 * @param options.locale - "ar" | "en" (numeric formatting locale)
 */
export function formatPrice(
  halalas: number | null | undefined,
  options: { decimals?: number; locale?: "ar" | "en" } = {},
): string {
  const { decimals = 2, locale = "en" } = options
  if (halalas == null) return "—"
  const sar = halalasToSar(halalas)
  const fmtLocale = locale === "ar" ? "ar-SA-u-nu-latn" : "en-US"
  return sar.toLocaleString(fmtLocale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}
