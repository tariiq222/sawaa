import { sarToHalalas } from "@/lib/money"

/** Normalize the numerals and separators commonly used in Arabic/Persian input. */
export function normalizeMoneyInput(value: string): string {
  return (
    value
      .trim()
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
      // Arabic thousands separator is grouping, while Arabic/Persian comma and
      // decimal punctuation are accepted as decimal separators.
      .replace(/[٬]/g, "")
      .replace(/[٫،，,]/g, ".")
  )
}

/** Parse a normalized monetary input, returning null for malformed values. */
export function parseMoneyInput(value: string): number | null {
  const normalized = normalizeMoneyInput(value)
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

/** Convert a user-entered SAR amount into integer halalas. */
export function moneyInputToHalalas(value: string): number | null {
  const parsed = parseMoneyInput(value)
  return parsed === null ? null : sarToHalalas(parsed)
}

// Descriptive aliases keep the helper convenient for other dashboard forms.
export const normalizeDigits = normalizeMoneyInput
export const parseMoneyToHalalas = moneyInputToHalalas
