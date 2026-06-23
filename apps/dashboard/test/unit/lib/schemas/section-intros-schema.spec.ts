/**
 * Section-intros zod schema — unit tests.
 *
 * Covers:
 *  - sectionIntrosSchema: 8 named intros (features / clinics /
 *    supportGroups / team / testimonials / blog / faq / cta) — every one
 *    is required by the public home page.
 *  - Per-intro shape: tag, titlePrefix, titleHighlight, subtitle are
 *    required; titleSuffix is OPTIONAL (some sections don't need a
 *    trailing word).
 *  - String bounds (1-500 chars) — overflow would shatter the home
 *    layout which is fixed-height.
 */

import { describe, it, expect } from "vitest"
import { sectionIntrosSchema } from "@/lib/schemas/section-intros.schema"

function validIntro() {
  return {
    tag: "الوسم",
    titlePrefix: "بداية العنوان",
    titleHighlight: "النص المميّز",
    titleSuffix: "نهاية العنوان",
    subtitle: "الوصف",
  }
}

function validSectionIntros() {
  return {
    features: validIntro(),
    clinics: validIntro(),
    supportGroups: validIntro(),
    team: validIntro(),
    testimonials: validIntro(),
    blog: validIntro(),
    faq: validIntro(),
    cta: validIntro(),
  }
}

describe("sectionIntrosSchema", () => {
  it("accepts a fully-valid intros payload", () => {
    const r = sectionIntrosSchema.safeParse(validSectionIntros())
    expect(r.success).toBe(true)
  })

  it("accepts an empty titleSuffix (no min length — sections may not need a trailing word)", () => {
    // titleSuffix is the only optional-by-string field on the intro shape;
    // an empty string is allowed and renders as no trailing word.
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      features: { ...validIntro(), titleSuffix: "" },
    })
    expect(r.success).toBe(true)
  })

  it("rejects an empty titleHighlight with a localized message", () => {
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      features: { ...validIntro(), titleHighlight: "" },
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) =>
        i.path.join(".") === "features.titleHighlight",
      )
      expect(issue).toBeDefined()
      expect(issue?.message).toContain("النص المميّز")
    }
  })

  it("rejects an empty tag with a localized message", () => {
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      features: { ...validIntro(), tag: "" },
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) =>
        i.path.join(".") === "features.tag",
      )
      expect(issue).toBeDefined()
      expect(issue?.message).toContain("الوسم")
    }
  })

  it("rejects an empty subtitle with a localized message", () => {
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      features: { ...validIntro(), subtitle: "" },
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) =>
        i.path.join(".") === "features.subtitle",
      )
      expect(issue).toBeDefined()
      expect(issue?.message).toContain("الوصف")
    }
  })

  it("rejects a missing intro section (e.g. no 'faq')", () => {
    const { faq: _faq, ...rest } = validSectionIntros()
    const r = sectionIntrosSchema.safeParse(rest)
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path[0] === "faq")
      expect(issue).toBeDefined()
    }
  })

  it("rejects a 501-char subtitle (overflow guard)", () => {
    const long = "x".repeat(501)
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      features: { ...validIntro(), subtitle: long },
    })
    expect(r.success).toBe(false)
  })

  it("accepts a 500-char subtitle (boundary)", () => {
    const exact = "x".repeat(500)
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      features: { ...validIntro(), subtitle: exact },
    })
    expect(r.success).toBe(true)
  })

  it("rejects an empty team.titlePrefix", () => {
    const r = sectionIntrosSchema.safeParse({
      ...validSectionIntros(),
      team: { ...validIntro(), titlePrefix: "" },
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issue = r.error.issues.find((i) =>
        i.path.join(".") === "team.titlePrefix",
      )
      expect(issue).toBeDefined()
      expect(issue?.message).toContain("بداية العنوان")
    }
  })
})
