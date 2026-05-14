import { z } from "zod"

/**
 * Global Zod error map — renders validation errors in Arabic to match
 * the dashboard's RTL UI. Runs once on module import (call site: app/layout.tsx).
 */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined" || issue.received === "null") {
        return { message: "هذا الحقل مطلوب" }
      }
      return { message: `النوع غير صحيح (المتوقع: ${issue.expected})` }

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return issue.minimum === 1
          ? { message: "هذا الحقل مطلوب" }
          : { message: `يجب ألا يقل عن ${issue.minimum} حرفاً` }
      }
      if (issue.type === "number") {
        return { message: `يجب ألا تقل القيمة عن ${issue.minimum}` }
      }
      if (issue.type === "array") {
        return { message: `يجب اختيار ${issue.minimum} على الأقل` }
      }
      return { message: "القيمة صغيرة جداً" }

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `يجب ألا يتجاوز ${issue.maximum} حرفاً` }
      }
      if (issue.type === "number") {
        return { message: `يجب ألا تتجاوز القيمة ${issue.maximum}` }
      }
      return { message: "القيمة كبيرة جداً" }

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "بريد إلكتروني غير صحيح" }
      if (issue.validation === "url") return { message: "رابط غير صحيح" }
      if (issue.validation === "uuid") return { message: "معرّف غير صحيح" }
      if (issue.validation === "regex") return { message: "الصيغة غير صحيحة" }
      return { message: "قيمة نصية غير صحيحة" }

    case z.ZodIssueCode.invalid_enum_value:
      return { message: "خيار غير صحيح" }

    case z.ZodIssueCode.invalid_date:
      return { message: "تاريخ غير صحيح" }

    case z.ZodIssueCode.custom:
      return { message: issue.message ?? "قيمة غير صحيحة" }

    default:
      return { message: ctx.defaultError }
  }
})
