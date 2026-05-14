import { describe, expect, it } from "vitest"
import { branchSchema } from "@/lib/schemas/branch.schema"

const valid = {
  nameAr: "الفرع الرئيسي",
  nameEn: "Main Branch",
  address: "King Fahd Rd",
  phone: "+966501234567",
  isMain: true,
  isActive: true,
  timezone: "Asia/Riyadh",
}

describe("branchSchema", () => {
  it("accepts a fully-populated valid branch", () => {
    expect(branchSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts omitted optional fields (address, phone)", () => {
    const { address, phone, ...rest } = valid
    expect(branchSchema.safeParse(rest).success).toBe(true)
  })

  it("rejects empty names in either language", () => {
    expect(branchSchema.safeParse({ ...valid, nameAr: "" }).success).toBe(false)
    expect(branchSchema.safeParse({ ...valid, nameEn: "" }).success).toBe(false)
  })

  it("rejects names longer than 255 chars", () => {
    expect(branchSchema.safeParse({ ...valid, nameEn: "x".repeat(256) }).success).toBe(false)
  })

  it("rejects addresses longer than 500 chars", () => {
    expect(branchSchema.safeParse({ ...valid, address: "x".repeat(501) }).success).toBe(false)
  })

  it("accepts an empty phone string", () => {
    // Schema allows empty via the refine short-circuit (!v is true for "").
    expect(branchSchema.safeParse({ ...valid, phone: "" }).success).toBe(true)
  })

  it("rejects a phone without the international + prefix", () => {
    expect(branchSchema.safeParse({ ...valid, phone: "966501234567" }).success).toBe(false)
  })

  it("rejects a phone with letters or spaces", () => {
    expect(branchSchema.safeParse({ ...valid, phone: "+96650 12345" }).success).toBe(false)
    expect(branchSchema.safeParse({ ...valid, phone: "+9665abc1234" }).success).toBe(false)
  })

  it("rejects non-boolean isMain / isActive", () => {
    expect(branchSchema.safeParse({ ...valid, isMain: "yes" }).success).toBe(false)
    expect(branchSchema.safeParse({ ...valid, isActive: 1 }).success).toBe(false)
  })

  it("requires a timezone string", () => {
    const { timezone, ...rest } = valid
    expect(branchSchema.safeParse(rest).success).toBe(false)
  })
})
