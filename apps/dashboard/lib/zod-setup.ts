import { z } from "zod"

/**
 * Global Zod error map — locale-aware validation messages.
 *
 * The map runs per-validation (client-side), so it reads the active locale
 * from localStorage at call time. Arabic is the default before localStorage is
 * available (SSR / first paint) to match the RTL-first UI.
 * Runs once on module import (call site: query-provider.tsx).
 *
 * Written for zod 4 (`z.config({ customError })`). Every message is kept
 * identical to what the zod 3 map produced; the behaviour is pinned by
 * `test/unit/lib/schemas/zod-message-pins.spec.ts`. Schema-level messages
 * (`.min(1, "key")`, `{ error }`) still win over this map.
 */

type BiMsg = { ar: string; en: string }
type RawIssue = z.core.$ZodRawIssue

function currentLocale(): "ar" | "en" {
  if (typeof window === "undefined") return "ar"
  return window.localStorage.getItem("sawaa-locale") === "en" ? "en" : "ar"
}

const pick = (m: BiMsg): string => (currentLocale() === "en" ? m.en : m.ar)

const REQUIRED: BiMsg = { ar: "هذا الحقل مطلوب", en: "This field is required" }

const isMissing = (input: unknown): boolean => input === undefined || input === null

const invalidType = (expected: string): string =>
  pick({
    ar: `النوع غير صحيح (المتوقع: ${expected})`,
    en: `Invalid type (expected: ${expected})`,
  })

/** `'a' | 'b'` — how zod 3 printed the allowed values of an enum. */
const joinValues = (values: readonly unknown[], separator = " | "): string =>
  values.map((v) => (typeof v === "string" ? `'${v}'` : String(v))).join(separator)

/** Kind of the schema (or check) that raised the issue: "enum", "literal", "custom"… */
function sourceKind(issue: RawIssue): string | undefined {
  const def = (issue.inst as { _zod?: { def?: { type?: string } } } | undefined)?._zod?.def
  return def?.type
}

/** Size issues are reported per kind of value; integers count as numbers. */
function sizeKind(origin: unknown): "string" | "number" | "array" | "other" {
  if (origin === "string") return "string"
  if (origin === "number" || origin === "int") return "number"
  if (origin === "array") return "array"
  return "other"
}

function invalidTypeMessage(issue: Extract<RawIssue, { code: "invalid_type" }>): string {
  // z.instanceof(File) and friends report the class by name, even for null.
  if (sourceKind(issue) === "custom") return `Input not instance of ${issue.expected}`
  if (isMissing(issue.input)) return pick(REQUIRED)
  if (issue.expected === "date" && issue.input instanceof Date) {
    return pick({ ar: "تاريخ غير صحيح", en: "Invalid date" })
  }
  // `.int()` on a number that is not whole.
  if (typeof issue.format === "string" && typeof issue.input === "number" && Number.isFinite(issue.input)) {
    return invalidType("integer")
  }
  return invalidType(issue.expected === "tuple" ? "array" : issue.expected)
}

function tooSmallMessage(issue: Extract<RawIssue, { code: "too_small" }>): string {
  switch (sizeKind(issue.origin)) {
    case "string":
      return issue.minimum === 1
        ? pick(REQUIRED)
        : pick({
            ar: `يجب ألا يقل عن ${issue.minimum} حرفاً`,
            en: `Must be at least ${issue.minimum} characters`,
          })
    case "number":
      return pick({
        ar: `يجب ألا تقل القيمة عن ${issue.minimum}`,
        en: `Must be at least ${issue.minimum}`,
      })
    case "array":
      return pick({
        ar: `يجب اختيار ${issue.minimum} على الأقل`,
        en: `Select at least ${issue.minimum}`,
      })
    default:
      return pick({ ar: "القيمة صغيرة جداً", en: "Value is too small" })
  }
}

function tooBigMessage(issue: Extract<RawIssue, { code: "too_big" }>): string {
  switch (sizeKind(issue.origin)) {
    case "string":
      return pick({
        ar: `يجب ألا يتجاوز ${issue.maximum} حرفاً`,
        en: `Must not exceed ${issue.maximum} characters`,
      })
    case "number":
      return pick({
        ar: `يجب ألا تتجاوز القيمة ${issue.maximum}`,
        en: `Must not exceed ${issue.maximum}`,
      })
    default:
      return pick({ ar: "القيمة كبيرة جداً", en: "Value is too large" })
  }
}

function invalidFormatMessage(issue: Extract<RawIssue, { code: "invalid_format" }>): string {
  switch (issue.format) {
    case "email":
      return pick({ ar: "بريد إلكتروني غير صحيح", en: "Invalid email" })
    case "url":
      return pick({ ar: "رابط غير صحيح", en: "Invalid URL" })
    // `guid` is any 8-4-4-4-12 hex id; `uuid` also checks the RFC version bits.
    case "uuid":
    case "guid":
      return pick({ ar: "معرّف غير صحيح", en: "Invalid identifier" })
    case "regex":
      return pick({ ar: "الصيغة غير صحيحة", en: "Invalid format" })
    default:
      return pick({ ar: "قيمة نصية غير صحيحة", en: "Invalid value" })
  }
}

function invalidValueMessage(issue: Extract<RawIssue, { code: "invalid_value" }>): string {
  if (sourceKind(issue) === "literal") {
    return `Invalid literal value, expected ${JSON.stringify(issue.values[0])}`
  }
  if (isMissing(issue.input)) return pick(REQUIRED)
  if (typeof issue.input !== "string") return invalidType(joinValues(issue.values))
  return pick({ ar: "خيار غير صحيح", en: "Invalid option" })
}

z.config({
  customError: (issue) => {
    switch (issue.code) {
      case "invalid_type":
        return invalidTypeMessage(issue)
      case "too_small":
        return tooSmallMessage(issue)
      case "too_big":
        return tooBigMessage(issue)
      case "invalid_format":
        return invalidFormatMessage(issue)
      case "invalid_value":
        return invalidValueMessage(issue)
      case "custom":
        return pick({ ar: "قيمة غير صحيحة", en: "Invalid value" })
      case "invalid_union":
        return "Invalid input"
      case "unrecognized_keys":
        return `Unrecognized key(s) in object: ${joinValues(issue.keys, ", ")}`
      case "not_multiple_of":
        return `Number must be a multiple of ${issue.divisor}`
      default:
        // Remaining codes (map/set/record internals) keep zod's own wording.
        return undefined
    }
  },
})
