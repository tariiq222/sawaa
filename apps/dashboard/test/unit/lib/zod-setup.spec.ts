/**
 * The global Zod error map (lib/zod-setup.ts) localises every validation
 * message into Arabic. It is imported for its side effect in app/layout.tsx;
 * here we import it the same way and assert the rendered messages, because a
 * regression silently falls back to English Zod defaults in the RTL UI.
 */
import { describe, expect, it } from "vitest"
import { z } from "zod"
import "@/lib/zod-setup"

function firstMessage(result: z.SafeParseReturnType<unknown, unknown>): string | undefined {
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
})
