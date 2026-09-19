import { describe, expect, it } from "vitest"
import { buildItemPayload } from "@/components/features/packages/package-form-helpers"
import type { PackageItemFormData } from "@/lib/schemas/package.schema"

const legacyItem = {
  service: { mode: "INCLUDE" as const, ids: ["service-1"] },
  practitioner: { mode: "INCLUDE" as const, ids: ["employee-1"] },
  duration: { mode: "INCLUDE" as const, ids: ["duration-1"] },
  delivery: { mode: "ANY" as const, ids: [] },
  paidQuantity: 2,
  freeQuantity: 1,
  discountType: null,
  discountValue: 0,
}

describe("package form payload compatibility", () => {
  it("preserves untouched legacy constraints and a historical fixed unit price", () => {
    const item = {
      ...legacyItem,
      unitPriceSar: 125,
      originalConstraints: [
        { dimension: "SERVICE" as const, mode: "INCLUDE" as const, targetIds: ["service-1"] },
        { dimension: "PRACTITIONER" as const, mode: "EXCLUDE" as const, targetIds: ["employee-2"] },
      ],
    } as PackageItemFormData

    expect(buildItemPayload(item, 0)).toEqual({
      serviceId: "service-1",
      employeeId: "employee-1",
      durationOptionId: "duration-1",
      constraints: item.originalConstraints,
      unitPrice: 12500,
      label: undefined,
      paidQuantity: 2,
      freeQuantity: 1,
      discountType: null,
      discountValue: 0,
      sortOrder: 0,
    })
  })

  it("sends a flexible item with its fixed prepaid price and no legacy triple", () => {
    const item = {
      ...legacyItem,
      selectionMode: "FLEXIBLE" as const,
      practitioner: { mode: "ANY" as const, ids: [] },
      duration: { mode: "ANY" as const, ids: [] },
      unitPriceSar: 210,
    } as PackageItemFormData

    expect(buildItemPayload(item, 2)).toMatchObject({
      serviceId: undefined,
      employeeId: undefined,
      durationOptionId: undefined,
      unitPrice: 21000,
      sortOrder: 2,
    })
  })

  it("preserves an explicit saved zero override", () => {
    const item = { ...legacyItem, unitPriceSar: 0, hasUnitPriceOverride: true } as PackageItemFormData
    expect(buildItemPayload(item, 0).unitPrice).toBe(0)
  })
})
