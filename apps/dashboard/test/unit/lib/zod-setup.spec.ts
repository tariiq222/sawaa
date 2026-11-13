/**
 * The global Zod error map (lib/zod-setup.ts) localises every validation
 * message into Arabic. It is imported for its side effect in app/layout.tsx;
 * here we import it the same way and assert the rendered messages, because a
 * regression silently falls back to English Zod defaults in the RTL UI.
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"
import "@/lib/zod-setup"
import { emailAddress, entityId, formNumber } from "@/lib/schemas/primitives"

function firstMessage(result: z.ZodSafeParseResult<unknown>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message
}

describe("global zod error map (Arabic)", () => {
  it("reports a missing required field as 'هذا الحقل مطلوب'", () => {
    const schema = z.object({ name: z.string() })
    expect(firstMessage(schema.safeParse({}))).toBe("هذا الحقل مطلوب")
  })

  it("reports an empty string failing min(1) as required", () => {
    const schema = z.string().min(1)
    expect(firstMessage(schema.safeParse(""))).toBe("هذا الحقل مطلوب")
  })

  it("reports a too-short string with the minimum length", () => {
    const schema = z.string().min(5)
    expect(firstMessage(schema.safeParse("abc"))).toBe("يجب ألا يقل عن 5 حرفاً")
  })

  it("reports a too-small number with the minimum value", () => {
    const schema = z.number().min(10)
    expect(firstMessage(schema.safeParse(3))).toBe("يجب ألا تقل القيمة عن 10")
  })

  it("reports a too-short array as a selection minimum", () => {
    const schema = z.array(z.string()).min(2)
    expect(firstMessage(schema.safeParse(["one"]))).toBe("يجب اختيار 2 على الأقل")
  })

  it("reports a too-long string with the maximum length", () => {
    const schema = z.string().max(3)
    expect(firstMessage(schema.safeParse("abcdef"))).toBe("يجب ألا يتجاوز 3 حرفاً")
  })

  it("reports a too-big number with the maximum value", () => {
    const schema = z.number().max(100)
    expect(firstMessage(schema.safeParse(250))).toBe("يجب ألا تتجاوز القيمة 100")
  })

  it("reports an invalid email in Arabic", () => {
    const schema = z.string().email()
    expect(firstMessage(schema.safeParse("not-an-email"))).toBe("بريد إلكتروني غير صحيح")
  })

  it("reports an invalid uuid in Arabic", () => {
    const schema = z.string().uuid()
    expect(firstMessage(schema.safeParse("nope"))).toBe("معرّف غير صحيح")
  })

  it("reports a wrong enum casing as 'خيار غير صحيح' (e.g. in_person vs IN_PERSON)", () => {
    const schema = z.enum(["IN_PERSON", "ONLINE"])
    expect(firstMessage(schema.safeParse("in_person"))).toBe("خيار غير صحيح")
    expect(schema.safeParse("IN_PERSON").success).toBe(true)
  })

  it("keeps explicit per-schema messages (does not override custom keys)", () => {
    const schema = z.string().min(1, "common.required")
    expect(firstMessage(schema.safeParse(""))).toBe("common.required")
  })

  it("reports null like a missing value", () => {
    expect(firstMessage(z.string().safeParse(null))).toBe("هذا الحقل مطلوب")
    expect(firstMessage(z.enum(["A", "B"]).safeParse(undefined))).toBe("هذا الحقل مطلوب")
  })

  it("names the expected type for a wrong-typed value", () => {
    expect(firstMessage(z.string().safeParse(5))).toBe("النوع غير صحيح (المتوقع: string)")
    expect(firstMessage(z.number().safeParse(Number.NaN))).toBe("النوع غير صحيح (المتوقع: number)")
    expect(firstMessage(z.number().int().safeParse(1.5))).toBe("النوع غير صحيح (المتوقع: integer)")
    expect(firstMessage(z.enum(["A", "B"]).safeParse(5))).toBe("النوع غير صحيح (المتوقع: 'A' | 'B')")
  })

  it("reports a failed regex as an invalid format", () => {
    expect(firstMessage(z.string().regex(/^[0-9]+$/).safeParse("abc"))).toBe("الصيغة غير صحيحة")
  })

  it("switches to English when the stored locale is 'en'", () => {
    window.localStorage.setItem("sawaa-locale", "en")
    try {
      expect(firstMessage(z.string().min(1).safeParse(""))).toBe("This field is required")
      expect(firstMessage(z.number().max(5).safeParse(9))).toBe("Must not exceed 5")
    } finally {
      window.localStorage.removeItem("sawaa-locale")
    }
  })
})

describe("form schema primitives", () => {
  it("entityId accepts any 8-4-4-4-12 hex id, including ones without RFC version bits", () => {
    expect(entityId().safeParse("123e4567-e89b-42d3-a456-426614174000").success).toBe(true)
    expect(entityId().safeParse("00000000-0000-0000-0000-000000000001").success).toBe(true)
    expect(firstMessage(entityId().safeParse("nope"))).toBe("معرّف غير صحيح")
  })

  it("entityId and emailAddress apply their message to a malformed value only", () => {
    expect(firstMessage(entityId("pick.one").safeParse("nope"))).toBe("pick.one")
    expect(firstMessage(entityId("pick.one").safeParse(undefined))).toBe("هذا الحقل مطلوب")
    expect(firstMessage(emailAddress("bad.email").safeParse("nope"))).toBe("bad.email")
    expect(firstMessage(emailAddress("bad.email").safeParse(undefined))).toBe("هذا الحقل مطلوب")
    expect(emailAddress().safeParse("a@b.co").success).toBe(true)
  })

  it("formNumber converts form input and rejects what is not a finite number", () => {
    expect(formNumber().parse("12.5")).toBe(12.5)
    expect(formNumber().parse("")).toBe(0)
    expect(formNumber().safeParse("abc").success).toBe(false)
    expect(formNumber().safeParse("Infinity").success).toBe(false)
  })

  it("formNumber's message replaces 'not a number' only, never a range message", () => {
    const schema = formNumber("not.a.number").int().min(0, "too.small")
    expect(firstMessage(schema.safeParse("abc"))).toBe("not.a.number")
    expect(firstMessage(schema.safeParse(1.5))).toBe("not.a.number")
    expect(firstMessage(schema.safeParse(-1))).toBe("too.small")
    expect(firstMessage(formNumber("not.a.number").max(5).safeParse(9))).toBe("يجب ألا تتجاوز القيمة 5")
  })
})
