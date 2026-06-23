/**
 * Feature-cards zod schema — unit tests.
 *
 * Covers:
 *  - featureCardsSchema: tuple-of-3 (exactly 3 cards × {label, title, desc,
 *    icon}). The website renders a fixed 3-card row in the features section.
 *  - icon must be one of the curated FEATURE_CARD_ICON_OPTIONS (defends
 *    against a Lucide icon rename on the website side that would silently
 *    drop the icon from the render).
 *  - Bilingual text fields are required (no bilingual split in this
 *    schema — the website copies use one language per card).
 */

import { describe, it, expect } from "vitest"
import {
  featureCardsSchema,
} from "@/lib/schemas/feature-cards.schema"
import { FEATURE_CARD_ICON_OPTIONS } from "@/lib/types/feature-cards"

function validCard() {
  return {
    label: "كوادر سعودية",
    title: "معالج يفهم ثقافتك",
    desc: "فريق سعودي مصنّف.",
    icon: "BadgeCheck",
  }
}

describe("featureCardsSchema", () => {
  it("accepts a tuple of 3 valid cards", () => {
    const r = featureCardsSchema.safeParse({
      cards: [validCard(), validCard(), validCard()],
    })
    expect(r.success).toBe(true)
  })

  it("rejects fewer than 3 cards (home features section expects exactly 3)", () => {
    const r = featureCardsSchema.safeParse({
      cards: [validCard(), validCard()],
    })
    expect(r.success).toBe(false)
  })

  it("rejects more than 3 cards", () => {
    const r = featureCardsSchema.safeParse({
      cards: [validCard(), validCard(), validCard(), validCard()],
    })
    expect(r.success).toBe(false)
  })

  it("rejects an empty tuple", () => {
    const r = featureCardsSchema.safeParse({ cards: [] })
    expect(r.success).toBe(false)
  })

  it("rejects an empty label with the localized message", () => {
    const r = featureCardsSchema.safeParse({
      cards: [
        { ...validCard(), label: "" },
        validCard(),
        validCard(),
      ],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const labelIssue = r.error.issues.find((i) =>
        i.path.join(".") === "cards.0.label",
      )
      expect(labelIssue).toBeDefined()
      expect(labelIssue?.message).toContain("الوسم")
    }
  })

  it("rejects an empty title with the localized message", () => {
    const r = featureCardsSchema.safeParse({
      cards: [
        validCard(),
        { ...validCard(), title: "" },
        validCard(),
      ],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const titleIssue = r.error.issues.find((i) =>
        i.path.join(".") === "cards.1.title",
      )
      expect(titleIssue).toBeDefined()
      expect(titleIssue?.message).toContain("عنوان البطاقة")
    }
  })

  it("rejects an empty desc with the localized message", () => {
    const r = featureCardsSchema.safeParse({
      cards: [
        validCard(),
        validCard(),
        { ...validCard(), desc: "" },
      ],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const descIssue = r.error.issues.find((i) =>
        i.path.join(".") === "cards.2.desc",
      )
      expect(descIssue).toBeDefined()
      expect(descIssue?.message).toContain("الوصف")
    }
  })

  it("rejects an icon outside the curated set (e.g. a renamed Lucide icon)", () => {
    const r = featureCardsSchema.safeParse({
      cards: [
        validCard(),
        validCard(),
        { ...validCard(), icon: "NotARealIcon" as never },
      ],
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const iconIssue = r.error.issues.find((i) =>
        i.path.join(".") === "cards.2.icon",
      )
      expect(iconIssue).toBeDefined()
      expect(iconIssue?.message).toContain("اختر أيقونة من القائمة")
    }
  })

  it("accepts every icon in the curated set", () => {
    // Loop through the full set and build a tuple of 3 distinct icons.
    // (zod enum is exhaustive — if any icon is misspelled in the constant
    // list, this test will fail.)
    const icon0 = FEATURE_CARD_ICON_OPTIONS[0]
    const icon1 = FEATURE_CARD_ICON_OPTIONS[1]
    const icon2 = FEATURE_CARD_ICON_OPTIONS[2]
    const r = featureCardsSchema.safeParse({
      cards: [
        { ...validCard(), icon: icon0 },
        { ...validCard(), icon: icon1 },
        { ...validCard(), icon: icon2 },
      ],
    })
    expect(r.success).toBe(true)
  })
})
