/**
 * Support-groups zod schema — unit tests.
 *
 * Covers:
 *  - supportGroupItemSchema: required slug + bilingual name/desc + image
 *    + participants / sessions / format strings (kept as strings so the
 *    dashboard can format them with locale rules).
 *  - supportGroupsSchema: 1-20 items bound (the support-groups page caps
 *    at 20 entries).
 */

import { describe, it, expect } from "vitest"
import {
  supportGroupItemSchema,
  supportGroupsSchema,
} from "@/lib/schemas/support-groups.schema"

function validItem() {
  return {
    slug: "new-parents",
    name: "مجموعة الآباء الجدد",
    nameEn: "New Parents Group",
    desc: "دعم للأسر في بداية المسار.",
    descEn: "Support for families in early stages.",
    image: "/uploads/groups/new-parents.jpg",
    participants: "8-12",
    sessions: "8 جلسات",
    format: "حضوري + عن بُعد",
  }
}

describe("supportGroupItemSchema", () => {
  it("accepts a valid item", () => {
    const r = supportGroupItemSchema.safeParse(validItem())
    expect(r.success).toBe(true)
  })

  it("rejects an empty slug", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), slug: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("slug")
    }
  })

  it("rejects an empty nameEn", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), nameEn: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("nameEn")
    }
  })

  it("rejects an empty desc", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), desc: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("desc")
    }
  })

  it("rejects an empty image", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), image: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("image")
    }
  })

  it("rejects an empty participants string", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), participants: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("participants")
    }
  })

  it("rejects an empty sessions string", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), sessions: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("sessions")
    }
  })

  it("rejects an empty format string", () => {
    const r = supportGroupItemSchema.safeParse({ ...validItem(), format: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("format")
    }
  })

  it("rejects a missing field entirely", () => {
    const { slug: _slug, ...rest } = validItem()
    const r = supportGroupItemSchema.safeParse(rest)
    expect(r.success).toBe(false)
  })
})

describe("supportGroupsSchema", () => {
  it("accepts a single-item list", () => {
    const r = supportGroupsSchema.safeParse({ groups: [validItem()] })
    expect(r.success).toBe(true)
  })

  it("accepts up to 20 groups", () => {
    const r = supportGroupsSchema.safeParse({
      groups: Array.from({ length: 20 }, (_, i) => ({
        ...validItem(),
        slug: `group-${i}`,
      })),
    })
    expect(r.success).toBe(true)
  })

  it("rejects an empty list", () => {
    const r = supportGroupsSchema.safeParse({ groups: [] })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues[0]?.path).toContain("groups")
    }
  })

  it("rejects more than 20 groups (page cap)", () => {
    const r = supportGroupsSchema.safeParse({
      groups: Array.from({ length: 21 }, (_, i) => ({
        ...validItem(),
        slug: `group-${i}`,
      })),
    })
    expect(r.success).toBe(false)
  })

  it("rejects when any group in the list is invalid", () => {
    const r = supportGroupsSchema.safeParse({
      groups: [validItem(), { ...validItem(), slug: "" }],
    })
    expect(r.success).toBe(false)
  })
})
