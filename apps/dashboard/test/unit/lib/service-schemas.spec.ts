import { describe, expect, it } from "vitest"
import { createCategorySchema, editCategorySchema } from "@/lib/schemas/service.schema"

describe("createCategorySchema", () => {
  it("accepts valid bilingual category", () => {
    const result = createCategorySchema.safeParse({
      nameEn: "Physiotherapy",
      nameAr: "علاج طبيعي",
      departmentId: "00000000-0000-0000-0000-000000000001",
    })
    expect(result.success).toBe(true)
  })

  it("accepts empty nameEn (optional field)", () => {
    const result = createCategorySchema.safeParse({ nameEn: "", nameAr: "علاج طبيعي", departmentId: "00000000-0000-0000-0000-000000000001" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.nameEn).toBeUndefined()
  })

  it("rejects empty nameAr", () => {
    const result = createCategorySchema.safeParse({ nameEn: "Physio", nameAr: "", departmentId: "00000000-0000-0000-0000-000000000001" })
    expect(result.success).toBe(false)
  })

  it("coerces sortOrder string to number", () => {
    const result = createCategorySchema.safeParse({
      nameEn: "Physio",
      nameAr: "علاج",
      sortOrder: "5",
      departmentId: "00000000-0000-0000-0000-000000000001",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.sortOrder).toBe(5)
  })
})

describe("editCategorySchema", () => {
  it("accepts all-optional payload", () => {
    const result = editCategorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts isActive toggle", () => {
    const result = editCategorySchema.safeParse({ isActive: false })
    expect(result.success).toBe(true)
  })
})
