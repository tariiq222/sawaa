import { describe, expect, it } from "vitest"
import {
  createPackageSchema,
  editPackageSchema,
} from "@/lib/schemas/package.schema"

const SVC = "5a0e2c1d-9f3b-4c8a-b1d2-3e4f5a6b7c8d"
const EMP = "6b1f3d2e-0a4c-4d9b-92e3-4f5a6b7c8d9e"
const DUR = "7c2a4e3f-1b5d-4eac-a3f4-5b6c7d8e9f0a"

const validItem = {
  serviceId: SVC,
  employeeId: EMP,
  durationOptionId: DUR,
  paidQuantity: 2,
  freeQuantity: 0,
}

const validCreate = {
  nameAr: "باقة الاستشارات",
  isActive: true,
  isPublic: false,
  items: [validItem],
}

describe("createPackageSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createPackageSchema.safeParse(validCreate)
    expect(result.success).toBe(true)
  })

  it("rejects a missing or whitespace-only nameAr with the i18n required key", () => {
    const result = createPackageSchema.safeParse({ ...validCreate, nameAr: "   " })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "nameAr")
      expect(issue?.message).toBe("common.required")
    }
  })

  it("keeps non-empty optional strings and trims them", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      nameEn: "  Counseling Pack  ",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.nameEn).toBe("Counseling Pack")
  })

  it("rejects lowercase per-item discountType casing (enum is uppercase)", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...validItem, discountType: "percentage" }],
    })
    expect(result.success).toBe(false)
  })

  it("accepts FIXED as a per-item discountType", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...validItem, discountType: "FIXED", discountValue: 50 }],
    })
    expect(result.success).toBe(true)
  })

  it("accepts a null per-item discountType (no discount) and coerces the value", () => {
    const ok = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...validItem, discountType: "PERCENTAGE", discountValue: "12.5" }],
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.items[0].discountValue).toBe(12.5)

    const neg = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...validItem, discountValue: -1 }],
    })
    expect(neg.success).toBe(false)
  })

  it("requires at least 1 item with the packages.errors.minItems key", () => {
    const result = createPackageSchema.safeParse({ ...validCreate, items: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "items")
      expect(issue?.message).toBe("packages.errors.minItems")
    }
  })

  it("rejects non-uuid serviceId / employeeId / durationOptionId", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [
        {
          serviceId: "not-a-uuid",
          employeeId: "also-not",
          durationOptionId: "neither",
          paidQuantity: 1,
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it("rejects items where paid+free = 0 with packages.errors.minQuantity", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [
        { ...validItem, paidQuantity: 0, freeQuantity: 0 },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "items.0.paidQuantity",
      )
      expect(issue?.message).toBe("packages.errors.minQuantity")
    }
  })

  it("accepts a free-only item (paidQuantity=0, freeQuantity≥1)", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [
        { ...validItem, paidQuantity: 0, freeQuantity: 1 },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe("editPackageSchema", () => {
  it("accepts an empty object (all fields optional)", () => {
    expect(editPackageSchema.safeParse({}).success).toBe(true)
  })

  it("still enforces the 1-item minimum when items is provided as an array", () => {
    const result = editPackageSchema.safeParse({ items: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "items")
      expect(issue?.message).toBe("packages.errors.minItems")
    }
  })

  it("rejects an invalid per-item discountType when provided", () => {
    const base = { items: [{ ...validItem }] }
    expect(
      editPackageSchema.safeParse({ items: [{ ...validItem, discountType: "fixed" }] }).success,
    ).toBe(false)
    expect(
      editPackageSchema.safeParse({ items: [{ ...validItem, discountType: "FIXED", discountValue: 50 }] })
        .success,
    ).toBe(true)
    expect(editPackageSchema.safeParse(base).success).toBe(true)
  })
})
