import { describe, expect, it } from "vitest"
import {
  createCategorySchema,
  editCategorySchema,
} from "@/lib/schemas/service.schema"

describe("createCategorySchema", () => {
  it("accepts a valid payload", () => {
    const ok = createCategorySchema.safeParse({ nameAr: "قلب", nameEn: "Cardiology", sortOrder: 5 })
    expect(ok.success).toBe(true)
  })

  it("rejects empty / whitespace-only nameAr", () => {
    expect(createCategorySchema.safeParse({ nameAr: "" }).success).toBe(false)
    expect(createCategorySchema.safeParse({ nameAr: "   " }).success).toBe(false)
  })

  it("rejects nameAr longer than 200", () => {
    expect(createCategorySchema.safeParse({ nameAr: "ا".repeat(201) }).success).toBe(false)
  })

  it("normalises empty nameEn and empty departmentId to undefined", () => {
    const r = createCategorySchema.safeParse({ nameAr: "قلب", nameEn: "", departmentId: "" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.nameEn).toBeUndefined()
      expect(r.data.departmentId).toBeUndefined()
    }
  })

  it("rejects malformed departmentId UUID", () => {
    expect(
      createCategorySchema.safeParse({ nameAr: "قلب", departmentId: "not-a-uuid" }).success,
    ).toBe(false)
  })

  it("coerces sortOrder and rejects out-of-range values", () => {
    const ok = createCategorySchema.safeParse({ nameAr: "قلب", sortOrder: "7" })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.sortOrder).toBe(7)
    expect(createCategorySchema.safeParse({ nameAr: "قلب", sortOrder: 1000 }).success).toBe(false)
    expect(createCategorySchema.safeParse({ nameAr: "قلب", sortOrder: -1 }).success).toBe(false)
  })
})

describe("editCategorySchema", () => {
  it("treats all fields as optional", () => {
    expect(editCategorySchema.safeParse({}).success).toBe(true)
  })

  it("accepts null departmentId (clear association)", () => {
    expect(editCategorySchema.safeParse({ departmentId: null }).success).toBe(true)
  })

  it("accepts isActive boolean", () => {
    expect(editCategorySchema.safeParse({ isActive: true }).success).toBe(true)
    expect(editCategorySchema.safeParse({ isActive: false }).success).toBe(true)
  })
})
