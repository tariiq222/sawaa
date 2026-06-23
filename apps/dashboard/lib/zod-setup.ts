import { z } from "zod"

/**
 * Global Zod error map — locale-aware validation messages.
 *
 * The map runs per-validation (client-side), so it reads the active locale
 * from localStorage at call time. Arabic is the default before localStorage is
 * available (SSR / first paint) to match the RTL-first UI.
 * Runs once on module import (call site: query-provider.tsx).
 */

type BiMsg = { ar: string; en: string }

function currentLocale(): "ar" | "en" {
  if (typeof window === "undefined") return "ar"
  return window.localStorage.getItem("sawaa-locale") === "en" ? "en" : "ar"
}

const pick = (m: BiMsg): string => (currentLocale() === "en" ? m.en : m.ar)

z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: pick({ ar: "هذا الحقل مطلوب", en: "This field is required" }) }
      }
      return {
        message: pick({
          ar: `النوع غير صحيح (المتوقع: ${issue.expected})`,
          en: `Invalid type (expected: ${issue.expected})`,
        }),
      }

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return issue.minimum === 1
          ? { message: pick({ ar: "هذا الحقل مطلوب", en: "This field is required" }) }
          : {
              message: pick({
                ar: `يجب ألا يقل عن ${issue.minimum} حرفاً`,
                en: `Must be at least ${issue.minimum} characters`,
              }),
            }
      }
      if (issue.type === "number") {
        return {
          message: pick({
            ar: `يجب ألا تقل القيمة عن ${issue.minimum}`,
            en: `Must be at least ${issue.minimum}`,
          }),
        }
      }
      if (issue.type === "array") {
        return {
          message: pick({
            ar: `يجب اختيار ${issue.minimum} على الأقل`,
            en: `Select at least ${issue.minimum}`,
          }),
        }
      }
      return { message: pick({ ar: "القيمة صغيرة جداً", en: "Value is too small" }) }

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return {
          message: pick({
            ar: `يجب ألا يتجاوز ${issue.maximum} حرفاً`,
            en: `Must not exceed ${issue.maximum} characters`,
          }),
        }
      }
      if (issue.type === "number") {
        return {
          message: pick({
            ar: `يجب ألا تتجاوز القيمة ${issue.maximum}`,
            en: `Must not exceed ${issue.maximum}`,
          }),
        }
      }
      return { message: pick({ ar: "القيمة كبيرة جداً", en: "Value is too large" }) }

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email")
        return { message: pick({ ar: "بريد إلكتروني غير صحيح", en: "Invalid email" }) }
      if (issue.validation === "url")
        return { message: pick({ ar: "رابط غير صحيح", en: "Invalid URL" }) }
      if (issue.validation === "uuid")
        return { message: pick({ ar: "معرّف غير صحيح", en: "Invalid identifier" }) }
      if (issue.validation === "regex")
        return { message: pick({ ar: "الصيغة غير صحيحة", en: "Invalid format" }) }
      return { message: pick({ ar: "قيمة نصية غير صحيحة", en: "Invalid value" }) }

    case z.ZodIssueCode.invalid_enum_value:
      return { message: pick({ ar: "خيار غير صحيح", en: "Invalid option" }) }

    case z.ZodIssueCode.invalid_date:
      return { message: pick({ ar: "تاريخ غير صحيح", en: "Invalid date" }) }

    case z.ZodIssueCode.custom:
      return { message: issue.message ?? pick({ ar: "قيمة غير صحيحة", en: "Invalid value" }) }

    default:
      return { message: ctx.defaultError }
  }
})
