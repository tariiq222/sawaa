// Mobile money helpers — thin re-export of the canonical shared module.
// Do not add logic here; the source of truth is @sawaa/shared/money.
import {
  HALALAS_PER_SAR,
  sarToHalalas,
  halalasToSar as halalasToSarNumberShared,
  formatHalalas,
} from "@sawaa/shared/money";

export { HALALAS_PER_SAR, sarToHalalas };

/** halalas -> SAR-major number. */
export const halalasToSarNumber = halalasToSarNumberShared;

/** halalas -> SAR string with 2 decimals (back-compat with old mobile API). */
export function halalasToSar(halalas: number): string {
  return formatHalalas(halalas, { locale: "en" });
}

export { formatHalalas };
