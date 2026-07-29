/**
 * Shared validators — framework-agnostic validation constants.
 *
 * Imported by the backend (class-validator @Matches) and by the dashboard
 * forms when they want to mirror server-side rules.
 *
 * Kept framework-free (no class-validator, no zod) so this package stays
 * usable from anywhere. The shape of each constant is the same — a RegExp
 * — so any consumer can apply it via the framework of their choice.
 */

/**
 * Saudi mobile phone format after normalization: +966 then a leading 5 then
 * 8 digits. Examples that match: +966501234567, +966559876543.
 *
 * The NormalizePhone transformer in the backend is responsible for
 * converting free-form input (e.g. "0501234567", "5 0123 4567", "+966 50 123 4567")
 * to this canonical E.164 form before the regex is applied.
 */
export const SAUDI_PHONE_REGEX = /^\+9665\d{8}$/

/**
 * The human-readable error message used by class-validator when SAUDI_PHONE_REGEX
 * fails. Centralized so AR/EN wording doesn't drift across DTOs.
 */
export const SAUDI_PHONE_ERROR_AR = 'رقم الجوال يجب أن يكون رقماً سعودياً بصيغة ‎+9665XXXXXXXX'
export const SAUDI_PHONE_ERROR_EN = 'Phone must be a Saudi mobile in +9665XXXXXXXX format'

/**
 * Returns the SAUDI_PHONE_ERROR message in the locale inferred from
 * the optional ISO code (defaults to AR — Sawa is single-tenant and the
 * default UI language is Arabic).
 */
export function saudiPhoneErrorMessage(locale?: string): string {
  return locale?.toLowerCase().startsWith('en') ? SAUDI_PHONE_ERROR_EN : SAUDI_PHONE_ERROR_AR
}