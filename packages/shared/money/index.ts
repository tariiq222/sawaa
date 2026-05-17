//
// Canonical monetary module for the Sawa monorepo.
//
// THE CANONICAL UNIT IS THE INTEGER HALALA. 1 SAR = 100 halalas.
// Every monetary value in the database, in API payloads, and in business
// logic is an integer count of halalas. SAR-major numbers/strings exist
// ONLY at the UI render boundary, produced by formatHalalas().
//
// Do not introduce a second money helper. Import from "@sawaa/shared/money".

export const HALALAS_PER_SAR = 100;

/** Convert a SAR-major number (e.g. user input 120.5) to integer halalas. */
export function sarToHalalas(sar: number): number {
  return Math.round(sar * HALALAS_PER_SAR);
}

/** Convert integer halalas to a SAR-major number (e.g. 12000 -> 120). */
export function halalasToSar(halalas: number): number {
  return halalas / HALALAS_PER_SAR;
}

export interface FormatHalalasOptions {
  /** BCP-47 locale for digit grouping. Defaults to "en". */
  locale?: string;
  /** Number of fraction digits. Defaults to 2. */
  decimals?: number;
}

/** Render integer halalas as a localized SAR-major string (no currency symbol). */
export function formatHalalas(
  halalas: number,
  { locale = 'en', decimals = 2 }: FormatHalalasOptions = {},
): string {
  return halalasToSar(halalas).toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** True when the value is a non-negative integer count of halalas. */
export function isValidHalalas(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
