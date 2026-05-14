import { describe, expect, it } from "vitest"
import { departmentSchema } from "@/lib/schemas/department.schema"

describe("departmentSchema — sortOrder field", () => {
  const base = {
    nameAr: "قلبية",
    nameEn: "Cardiology",
    isActive: true,
    sortOrder: 0,
  }

  it("rejects missing sortOrder (required field)", () => {
    // sortOrder is required — the form always provides it via defaultValues
    const result = departmentSchema.safeParse({
      nameAr: "قلبية",
      nameEn: "Cardiology",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("accepts sortOrder of 0", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: 0 })
    expect(result.success).toBe(true)
  })

  it("accepts sortOrder of positive integers", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: 5 })
    expect(result.success).toBe(true)
  })

  it("accepts sortOrder of large positive integers", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: 999999 })
    expect(result.success).toBe(true)
  })

  it("rejects sortOrder of negative numbers", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: -1 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("sortOrder")
    }
  })

  it("rejects sortOrder of negative float", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: -0.5 })
    expect(result.success).toBe(false)
  })

  it("rejects sortOrder of non-integer numbers", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: 1.5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("sortOrder")
    }
  })

  it("rejects sortOrder of NaN", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: NaN })
    expect(result.success).toBe(false)
  })

  it("rejects sortOrder of Infinity", () => {
    const result = departmentSchema.safeParse({ ...base, sortOrder: Infinity })
    expect(result.success).toBe(false)
  })

  it("accepts full payload with sortOrder and icon", () => {
    const result = departmentSchema.safeParse({
      ...base,
      icon: "heart",
      sortOrder: 3,
      descriptionAr: "قسم القلب",
      descriptionEn: "Heart department",
    })
    expect(result.success).toBe(true)
  })
})
