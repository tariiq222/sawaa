import { describe, expect, it } from "vitest"
import { createBundleSchema, editBundleSchema } from "@/lib/schemas/bundle.schema"

const UUID_A = "5a0e2c1d-9f3b-4c8a-b1d2-3e4f5a6b7c8d"
const UUID_B = "6b1f3d2e-0a4c-4d9b-92e3-4f5a6b7c8d9e"

const validCreate = {
  nameAr: "باقة الاستشارات",
  discountType: "PERCENTAGE",
  discountValue: 10,
  serviceIds: [UUID_A, UUID_B],
}

describe("createBundleSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createBundleSchema.safeParse(validCreate)
    expect(result.success).toBe(true)
  })

  it("rejects a missing or whitespace-only nameAr with the i18n required key", () => {
    const result = createBundleSchema.safeParse({ ...validCreate, nameAr: "   " })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "nameAr")
      expect(issue?.message).toBe("common.required")
    }
  })

  it("transforms empty optional strings to undefined", () => {
    const result = createBundleSchema.safeParse({
      ...validCreate,
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nameEn).toBeUndefined()
      expect(result.data.descriptionAr).toBeUndefined()
      expect(result.data.descriptionEn).toBeUndefined()
    }
  })

  it("keeps non-empty optional strings and trims them", () => {
    const result = createBundleSchema.safeParse({
      ...validCreate,
      nameEn: "  Counseling Bundle  ",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.nameEn).toBe("Counseling Bundle")
  })

  it("rejects lowercase discountType casing (enum is uppercase)", () => {
    // Past P0 in this repo: schema/enum casing drift (IN_PERSON vs in_person).
    const result = createBundleSchema.safeParse({ ...validCreate, discountType: "percentage" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["discountType"])
    }
  })

  it("accepts FIXED as discountType", () => {
    const result = createBundleSchema.safeParse({ ...validCreate, discountType: "FIXED" })
    expect(result.success).toBe(true)
  })

  it("coerces a numeric string discountValue and rejects negatives", () => {
    const ok = createBundleSchema.safeParse({ ...validCreate, discountValue: "12.5" })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.discountValue).toBe(12.5)

    const neg = createBundleSchema.safeParse({ ...validCreate, discountValue: -1 })
    expect(neg.success).toBe(false)
  })

  it("requires at least 2 serviceIds with the bundles.errors.minServices key", () => {
    const result = createBundleSchema.safeParse({ ...validCreate, serviceIds: [UUID_A] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "serviceIds")
      expect(issue?.message).toBe("bundles.errors.minServices")
    }
  })

  it("rejects non-uuid serviceIds", () => {
    const result = createBundleSchema.safeParse({
      ...validCreate,
      serviceIds: ["not-a-uuid", "also-not-a-uuid"],
    })
    expect(result.success).toBe(false)
  })

  it("rejects non-integer sortOrder but coerces an integer string", () => {
    const float = createBundleSchema.safeParse({ ...validCreate, sortOrder: 1.5 })
    expect(float.success).toBe(false)

    const coerced = createBundleSchema.safeParse({ ...validCreate, sortOrder: "3" })
    expect(coerced.success).toBe(true)
    if (coerced.success) expect(coerced.data.sortOrder).toBe(3)
  })
})

describe("editBundleSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(editBundleSchema.safeParse({}).success).toBe(true)
  })

  it("still enforces the 2-service minimum when serviceIds is provided", () => {
    const result = editBundleSchema.safeParse({ serviceIds: [UUID_A] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "serviceIds")
      expect(issue?.message).toBe("bundles.errors.minServices")
    }
  })

  it("rejects an invalid discountType when provided", () => {
    expect(editBundleSchema.safeParse({ discountType: "fixed" }).success).toBe(false)
    expect(editBundleSchema.safeParse({ discountType: "FIXED" }).success).toBe(true)
  })
})
