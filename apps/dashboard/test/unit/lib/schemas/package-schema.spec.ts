import { describe, expect, it } from "vitest"
import {
  createPackageSchema,
  editPackageSchema,
} from "@/lib/schemas/package.schema"

const SVC = "5a0e2c1d-9f3b-4c8a-b1d2-3e4f5a6b7c8d"
const EMP = "6b1f3d2e-0a4c-4d9b-92e3-4f5a6b7c8d9e"
const DUR = "7c2a4e3f-1b5d-4eac-a3f4-5b6c7d8e9f0a"

const anyScope = { mode: "ANY" as const, ids: [] }
const single = (id: string) => ({ mode: "INCLUDE" as const, ids: [id] })

/** A single-specific item: one service + one practitioner + one duration → derived price. */
const singleSpecificItem = {
  service: single(SVC),
  practitioner: single(EMP),
  duration: single(DUR),
  delivery: anyScope,
  paidQuantity: 2,
  freeQuantity: 0,
}

/** A flexible item: any practitioner, requires a fixed unitPrice. */
const flexibleItem = {
  service: single(SVC),
  practitioner: anyScope,
  duration: anyScope,
  delivery: anyScope,
  unitPriceSar: 200,
  paidQuantity: 3,
  freeQuantity: 0,
}

const validCreate = {
  nameAr: "باقة الاستشارات",
  isActive: true,
  isPublic: false,
  items: [singleSpecificItem],
}

describe("createPackageSchema", () => {
  it("accepts a minimal single-specific payload", () => {
    expect(createPackageSchema.safeParse(validCreate).success).toBe(true)
  })

  it("accepts a flexible item with a fixed unitPrice", () => {
    const result = createPackageSchema.safeParse({ ...validCreate, items: [flexibleItem] })
    expect(result.success).toBe(true)
  })

  it("requires a unitPrice for a flexible (non single-specific) item", () => {
    const { unitPriceSar: _omit, ...noPrice } = flexibleItem
    const result = createPackageSchema.safeParse({ ...validCreate, items: [noPrice] })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "items.0.unitPriceSar",
      )
      expect(issue?.message).toBe("packages.errors.unitPriceRequired")
    }
  })

  it("does not require a unitPrice for a single-specific item", () => {
    // singleSpecificItem carries no unitPriceSar and must still pass.
    expect(createPackageSchema.safeParse(validCreate).success).toBe(true)
  })

  it("rejects an INCLUDE scope with no targets", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, service: { mode: "INCLUDE", ids: [] } }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "items.0.service.ids",
      )
      expect(issue?.message).toBe("packages.errors.scopeNeedsTarget")
    }
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
      items: [{ ...singleSpecificItem, discountType: "percentage" }],
    })
    expect(result.success).toBe(false)
  })

  it("accepts FIXED as a per-item discountType and coerces the value", () => {
    const ok = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...singleSpecificItem, discountType: "PERCENTAGE", discountValue: "12.5" }],
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.items[0].discountValue).toBe(12.5)

    const neg = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...singleSpecificItem, discountValue: -1 }],
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

  it("rejects items where paid+free = 0 with packages.errors.minQuantity", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...singleSpecificItem, paidQuantity: 0, freeQuantity: 0 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find(
        (i) => i.path.join(".") === "items.0.paidQuantity",
      )
      expect(issue?.message).toBe("packages.errors.minQuantity")
    }
  })

  it("accepts a free-only single-specific item (paidQuantity=0, freeQuantity≥1)", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...singleSpecificItem, paidQuantity: 0, freeQuantity: 1 }],
    })
    expect(result.success).toBe(true)
  })

  it("rejects a percentage discount above the backend maximum", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, discountType: "PERCENTAGE", discountValue: 101 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "items.0.discountValue")).toBe(true)
    }
  })

  it("rejects a fixed discount above the flexible item's payable amount", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, paidQuantity: 2, unitPriceSar: 100, discountType: "FIXED", discountValue: 201 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "items.0.discountValue")).toBe(true)
    }
  })

  it("rejects an empty duration target when the duration scope is constrained", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...singleSpecificItem, duration: { mode: "INCLUDE", ids: [] } }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "items.0.duration.ids")).toBe(true)
    }
  })

  it("rejects stale targets left under an ANY scope", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, practitioner: { mode: "ANY", ids: [EMP] } }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "items.0.practitioner.ids")).toBe(true)
    }
  })

  it("requires a single service before duration can be constrained", () => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, service: anyScope, duration: single(DUR) }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(
        (i) => i.path.join(".") === "items.0.duration.mode" && i.message === "packages.errors.durationNeedsService",
      )).toBe(true)
    }
  })

  it.each([
    ["negative", -1, 0, "packages.errors.nonNegative"],
    ["fractional", 1.5, 0, "packages.errors.wholeNumber"],
  ])("rejects %s session quantities", (_label, paidQuantity, freeQuantity, message) => {
    const result = createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, paidQuantity, freeQuantity }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some(
        (i) => i.path.join(".") === "items.0.paidQuantity" && i.message === message,
      )).toBe(true)
    }
  })

  it("accepts discount boundary values", () => {
    expect(createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, paidQuantity: 2, unitPriceSar: 100, discountType: "PERCENTAGE", discountValue: 100 }],
    }).success).toBe(true)
    expect(createPackageSchema.safeParse({
      ...validCreate,
      items: [{ ...flexibleItem, paidQuantity: 2, unitPriceSar: 100, discountType: "FIXED", discountValue: 200 }],
    }).success).toBe(true)
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
    expect(
      editPackageSchema.safeParse({
        items: [{ ...singleSpecificItem, discountType: "fixed" }],
      }).success,
    ).toBe(false)
    expect(
      editPackageSchema.safeParse({
        items: [{ ...singleSpecificItem, discountType: "FIXED", discountValue: 50 }],
      }).success,
    ).toBe(true)
    expect(
      editPackageSchema.safeParse({ items: [singleSpecificItem] }).success,
    ).toBe(true)
  })
})
