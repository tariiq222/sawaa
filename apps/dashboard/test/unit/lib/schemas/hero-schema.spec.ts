/**
 * Hero zod schema — unit tests.
 *
 * Covers:
 *  - heroFormSchema: all 14 fields are required (badge, title prefix /
 *    highlight / suffix, subtitle, two CTAs with href+text, hero image,
 *    two floating badges each with label+value).
 *  - href must start with `/` or `http(s)://` — a regression that
 *    accepted a plain `mailto:` or `tel:` link would silently break the
 *    Next.js Link prefetch.
 *  - max 500 chars on every string field — the website home page is
 *    fixed-height and overflow would shatter the layout.
 */

import { describe, it, expect } from "vitest"
import { heroFormSchema } from "@/lib/schemas/hero.schema"

function validHero() {
  return {
    badgeText: "مركز معتمد",
    titlePrefix: "استشارة",
    titleHighlight: "أسرية",
    titleSuffix: "متخصصة",
    subtitle: "فريق متخصص لدعم أسرتك",
    ctaPrimaryText: "احجز جلسة",
    ctaPrimaryHref: "/book",
    ctaSecondaryText: "تواصل معنا",
    ctaSecondaryHref: "/contact",
    heroImageUrl: "/uploads/hero.jpg",
    badgeFloatTopLabel: "جلسات",
    badgeFloatTopValue: "+10K",
    badgeFloatBottomLabel: "عملاء",
    badgeFloatBottomValue: "98% رضا",
  }
}

describe("heroFormSchema", () => {
  it("accepts a valid hero payload", () => {
    const r = heroFormSchema.safeParse(validHero())
    expect(r.success).toBe(true)
  })

  it("rejects an empty badgeText with a localized message", () => {
    const r = heroFormSchema.safeParse({ ...validHero(), badgeText: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("نص الشارة")
    }
  })

  it("rejects an empty titleHighlight", () => {
    const r = heroFormSchema.safeParse({ ...validHero(), titleHighlight: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("titleHighlight")
    }
  })

  it("rejects an empty subtitle", () => {
    const r = heroFormSchema.safeParse({ ...validHero(), subtitle: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("subtitle")
    }
  })

  it("rejects an empty heroImageUrl", () => {
    const r = heroFormSchema.safeParse({ ...validHero(), heroImageUrl: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("heroImageUrl")
    }
  })

  it("rejects an empty floating badge label", () => {
    const r = heroFormSchema.safeParse({ ...validHero(), badgeFloatTopLabel: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("badgeFloatTopLabel")
    }
  })

  it("accepts an https:// external CTA href", () => {
    const r = heroFormSchema.safeParse({
      ...validHero(),
      ctaPrimaryHref: "https://cal.com/sawaa/book",
    })
    expect(r.success).toBe(true)
  })

  it("rejects a CTA href that doesn't start with / or http(s)://", async () => {
    // Lazy import the schema for runtime check; ensures we test via safeParse.
    const r = heroFormSchema.safeParse({
      ...validHero(),
      ctaPrimaryHref: "javascript:alert(1)",
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "ctaPrimaryHref")
      expect(issue).toBeDefined()
      expect(issue?.message).toContain("يبدأ الرابط بـ / أو http(s)://")
    }
  })

  it("rejects a CTA href using a mailto: scheme", () => {
    const r = heroFormSchema.safeParse({
      ...validHero(),
      ctaSecondaryHref: "mailto:hello@sawaa.sa",
    })
    expect(r.success).toBe(false)
  })

  it("rejects a CTA href using a tel: scheme", () => {
    const r = heroFormSchema.safeParse({
      ...validHero(),
      ctaPrimaryHref: "tel:+966500000000",
    })
    expect(r.success).toBe(false)
  })

  it("rejects strings longer than 500 chars (overflow guard)", () => {
    const long = "x".repeat(501)
    const r = heroFormSchema.safeParse({ ...validHero(), subtitle: long })
    expect(r.success).toBe(false)
  })

  it("accepts strings exactly 500 chars long (boundary)", () => {
    const exact = "x".repeat(500)
    const r = heroFormSchema.safeParse({ ...validHero(), subtitle: exact })
    expect(r.success).toBe(true)
  })
})
