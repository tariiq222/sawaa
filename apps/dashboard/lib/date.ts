/**
 * Date helpers — locale-aware date formatting for the dashboard.
 *
 * Two layers exist by design:
 *   1. `formatClinicDate(date, format)` in lib/utils.ts — used by booking
 *      tables/columns where the clinic's configured date format
 *      (Y-m-d / d/m/Y / m/d/Y from BrandingConfig) is the source of truth.
 *      Wrapped by `useOrganizationConfig().formatDate` for the common case.
 *   2. `formatLocaleDate(date, locale, options?)` (this file) — used by
 *      free-form list rows / charts / detail sheets where locale matters
 *      more than the clinic's configured format (e.g. month-name labels).
 *
 * Use this helper instead of inline `toLocaleDateString(locale === "ar" ?
 * "ar-SA" : "en-US", …)` so AR/EN parity stays consistent.
 */

import { format, formatDistanceToNow } from "date-fns"

export type DateLike = Date | string | number | null | undefined

type DatePatternOptions = NonNullable<Parameters<typeof format>[2]> & {
  fallback?: string
}

type RelativeTimeOptions = NonNullable<Parameters<typeof formatDistanceToNow>[1]> & {
  fallback?: string
}

const AR_LOCALE = "ar-SA"
const EN_LOCALE = "en-US"

function toValidDate(date: DateLike): Date | null {
  if (date == null) return null
  const d = date instanceof Date ? date : new Date(date)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Resolve our 2-letter locale to the matching BCP-47 tag. */
export function resolveDateLocale(locale: "ar" | "en" | string): string {
  return locale === "ar" ? AR_LOCALE : EN_LOCALE
}

/**
 * Format a date for display using the user's UI locale.
 * Returns an em-dash for null/undefined/invalid inputs so callers don't
 * need to guard.
 */
export function formatLocaleDate(
  date: DateLike,
  locale: "ar" | "en" | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toValidDate(date)
  if (!d) return "—"
  return d.toLocaleDateString(resolveDateLocale(locale), options)
}

/**
 * Safe date-fns formatter for dashboard render paths.
 * date-fns throws RangeError for invalid Date objects; UI cells should render
 * a placeholder instead of breaking the whole page.
 */
export function formatDatePattern(
  date: DateLike,
  pattern: string,
  options: DatePatternOptions = {},
): string {
  const { fallback = "—", ...formatOptions } = options
  const d = toValidDate(date)
  if (!d) return fallback
  return format(d, pattern, formatOptions)
}

export function formatRelativeTime(
  date: DateLike,
  options: RelativeTimeOptions = {},
): string {
  const { fallback = "—", ...formatOptions } = options
  const d = toValidDate(date)
  if (!d) return fallback
  return formatDistanceToNow(d, formatOptions)
}

export function formatDateTimeLocalValue(date: DateLike): string {
  const d = toValidDate(date)
  if (!d) return ""
  return d.toISOString().slice(0, 16)
}
