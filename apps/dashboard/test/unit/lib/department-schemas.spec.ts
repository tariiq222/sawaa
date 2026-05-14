import { describe, expect, it } from "vitest"
import { departmentSchema } from "@/lib/schemas/department.schema"

describe("departmentSchema", () => {
  const validPayload = {
    nameAr: "قلبية",
    nameEn: "Cardiology",
    isActive: true,
    sortOrder: 0,
  }

  it("accepts valid minimal payload", () => {
    const result = departmentSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it("accepts full payload with descriptions", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      descriptionAr: "قسم القلب",
      descriptionEn: "Heart department",
      icon: "heart",
    })
    expect(result.success).toBe(true)
  })

  it("accepts empty string for description", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      descriptionAr: "",
      descriptionEn: "",
    })
    expect(result.success).toBe(true)
  })

  it("accepts empty string for icon", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      icon: "",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing nameAr", () => {
    const result = departmentSchema.safeParse({
      nameEn: "Cardiology",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing nameEn", () => {
    const result = departmentSchema.safeParse({
      nameAr: "قلبية",
      isActive: true,
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty nameAr", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      nameAr: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty nameEn", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      nameEn: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing isActive", () => {
    const result = departmentSchema.safeParse({
      nameAr: "قلبية",
      nameEn: "Cardiology",
    })
    expect(result.success).toBe(false)
  })

  it("rejects nameAr exceeding 255 chars", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      nameAr: "أ".repeat(256),
    })
    expect(result.success).toBe(false)
  })

  it("rejects nameEn exceeding 255 chars", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      nameEn: "a".repeat(256),
    })
    expect(result.success).toBe(false)
  })

  it("rejects descriptionAr exceeding 1000 chars", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      descriptionAr: "أ".repeat(1001),
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-boolean isActive", () => {
    const result = departmentSchema.safeParse({
      ...validPayload,
      isActive: "yes",
    })
    expect(result.success).toBe(false)
  })
})
