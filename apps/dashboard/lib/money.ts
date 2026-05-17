// Dashboard money helpers — thin re-export of the canonical shared module.
// Do not add logic here; the source of truth is @sawaa/shared/money.
//
// The only dashboard-specific behavior preserved on top of the shared module
// is null/undefined tolerance: existing call-sites and tests pass nullish
// values and expect 0 (conversion) or "—" (display) instead of NaN.
import {
  HALALAS_PER_SAR,
  sarToHalalas as sharedSarToHalalas,
  halalasToSar as sharedHalalasToSar,
  formatHalalas,
  type FormatHalalasOptions,
} from "@sawaa/shared/money"

export { HALALAS_PER_SAR }

/** Convert SAR to integer halalas. Nullish input yields 0. */
export function sarToHalalas(sar: number | null | undefined): number {
  if (sar == null || Number.isNaN(sar)) return 0
  return sharedSarToHalalas(sar)
}

/** Convert integer halalas to a SAR-major number. Nullish input yields 0. */
export function halalasToSar(halalas: number | null | undefined): number {
  if (halalas == null || Number.isNaN(halalas)) return 0
  return sharedHalalasToSar(halalas)
}

/** Back-compat alias — halalasToSar returns a number. */
export const halalasToSarNumber = halalasToSar

/** Back-compat alias — formatPrice(halalas, opts) renders a SAR display string. */
export function formatPrice(
  halalas: number | null | undefined,
  opts?: FormatHalalasOptions,
): string {
  if (halalas == null || Number.isNaN(halalas)) return "—"
  return formatHalalas(halalas, opts)
}
