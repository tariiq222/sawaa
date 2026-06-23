/**
 * FAQ zod schema — unit tests.
 *
 * Covers:
 *  - faqItemSchema: required bilingual question/answer fields (q/qEn/a/aEn).
 *  - faqItemsSchema: 1-50 items bound (FAQ section caps at 50 entries).
 */

import { describe, it, expect } from "vitest"
import { faqItemSchema, faqItemsSchema } from "@/lib/schemas/faq.schema"

function validItem() {
  return {
    q: "ما هي ساعات العمل؟",
    qEn: "What are your working hours?",
    a: "من 9 ص إلى 9 م",
    aEn: "9 AM to 9 PM",
  }
}

describe("faqItemSchema", () => {
  it("accepts a valid item", () => {
    const r = faqItemSchema.safeParse(validItem())
    expect(r.success).toBe(true)
  })

  it("rejects an empty question (Arabic)", () => {
    const r = faqItemSchema.safeParse({ ...validItem(), q: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("q")
    }
  })

  it("rejects an empty question (English)", () => {
    const r = faqItemSchema.safeParse({ ...validItem(), qEn: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("qEn")
    }
  })

  it("rejects an empty answer (Arabic)", () => {
    const r = faqItemSchema.safeParse({ ...validItem(), a: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("a")
    }
  })

  it("rejects an empty answer (English)", () => {
    const r = faqItemSchema.safeParse({ ...validItem(), aEn: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("aEn")
    }
  })

  it("rejects when a required field is missing entirely", () => {
    const { q: _q, ...rest } = validItem()
    const r = faqItemSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })
})

describe("faqItemsSchema", () => {
  it("accepts a single-item list", () => {
    const r = faqItemsSchema.safeParse({ items: [validItem()] })
    expect(r.success).toBe(true)
  })

  it("accepts up to 50 items", () => {
    const r = faqItemsSchema.safeParse({
      items: Array.from({ length: 50 }, (_, i) => ({
        ...validItem(),
        qEn: `Question ${i}`,
      })),
    })
    expect(r.success).toBe(true)
  })

  it("rejects an empty list", () => {
    const r = faqItemsSchema.safeParse({ items: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("items")
    }
  })

  it("rejects more than 50 items", () => {
    const r = faqItemsSchema.safeParse({
      items: Array.from({ length: 51 }, (_, i) => ({
        ...validItem(),
        qEn: `Question ${i}`,
      })),
    })
    expect(r.success).toBe(false)
  })

  it("rejects when any item in the list is invalid", () => {
    const r = faqItemsSchema.safeParse({
      items: [validItem(), { ...validItem(), a: "" }],
    })
    expect(r.success).toBe(false)
  })
})
