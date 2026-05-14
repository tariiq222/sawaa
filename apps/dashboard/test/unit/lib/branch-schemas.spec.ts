import { describe, expect, it } from "vitest"
import { branchSchema } from "@/lib/schemas/branch.schema"

const validBranch = {
  nameAr: "فرع الرياض",
  nameEn: "Riyadh Branch",
  isMain: false,
  isActive: true,
  timezone: "Asia/Riyadh",
}

describe("branchSchema", () => {
  it("accepts a valid branch payload", () => {
    const result = branchSchema.safeParse(validBranch)
    expect(result.success).toBe(true)
  })

  it("rejects nameAr longer than 255 chars", () => {
    const result = branchSchema.safeParse({ ...validBranch, nameAr: "ع".repeat(256) })
    expect(result.success).toBe(false)
  })

  it("rejects nameEn longer than 255 chars", () => {
    const result = branchSchema.safeParse({ ...validBranch, nameEn: "a".repeat(256) })
    expect(result.success).toBe(false)
  })

  it("rejects address longer than 500 chars", () => {
    const result = branchSchema.safeParse({ ...validBranch, address: "a".repeat(501) })
    expect(result.success).toBe(false)
  })

  it("accepts valid E.164 phone", () => {
    const result = branchSchema.safeParse({ ...validBranch, phone: "+966112345678" })
    expect(result.success).toBe(true)
  })

  it("rejects non-E.164 phone", () => {
    const result = branchSchema.safeParse({ ...validBranch, phone: "011234567" })
    expect(result.success).toBe(false)
  })

  it("accepts valid email", () => {
    const result = branchSchema.safeParse({ ...validBranch, email: "branch@clinic.com" })
    expect(result.success).toBe(true)
  })

  it("accepts empty string email (no email provided)", () => {
    const result = branchSchema.safeParse({ ...validBranch, email: "" })
    expect(result.success).toBe(true)
  })
})
