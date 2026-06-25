/**
 * Unit tests for the resolvePreservedDurationOptionId pure helper.
 *
 * The helper lives in booking-pos.tsx and guards against a bug where
 * handleSelectDeliveryType would silently overwrite a credit-driven
 * durationOptionId with the serviceType's default/first option.
 */
import { describe, it, expect } from "vitest"
import { resolvePreservedDurationOptionId } from "@/components/features/bookings/booking-pos"
import type { EmployeeServiceType } from "@/lib/types/employee"

function makeServiceType(optionIds: string[]): EmployeeServiceType {
  return {
    id: "st1",
    employeeServiceId: "es1",
    deliveryType: "IN_PERSON",
    price: 20000,
    duration: 45,
    useCustomOptions: true,
    isActive: true,
    durationOptions: optionIds.map((id, i) => ({
      id,
      employeeServiceTypeId: "st1",
      label: `${45 + i * 15}min`,
      labelAr: null,
      durationMinutes: 45 + i * 15,
      price: 20000,
      isDefault: i === 0,
      sortOrder: i,
    })),
  }
}

describe("resolvePreservedDurationOptionId", () => {
  it("(a) preserves currentId when it exists among the new serviceType's options", () => {
    const serviceType = makeServiceType(["opt-a", "opt-b", "opt-c"])
    const result = resolvePreservedDurationOptionId("opt-b", serviceType, "opt-a")
    expect(result).toBe("opt-b")
  })

  it("(b) falls back to defaultId when currentId is NOT in the new serviceType's options", () => {
    const serviceType = makeServiceType(["opt-x", "opt-y"])
    const result = resolvePreservedDurationOptionId("opt-old", serviceType, "opt-x")
    expect(result).toBe("opt-x")
  })

  it("(c) returns defaultId when currentId is null (normal non-credit flow)", () => {
    const serviceType = makeServiceType(["opt-default"])
    const result = resolvePreservedDurationOptionId(null, serviceType, "opt-default")
    expect(result).toBe("opt-default")
  })

  it("returns null when defaultId is null and currentId is null", () => {
    const serviceType = makeServiceType([])
    const result = resolvePreservedDurationOptionId(null, serviceType, null)
    expect(result).toBeNull()
  })

  it("falls back to defaultId when serviceType is undefined", () => {
    const result = resolvePreservedDurationOptionId("opt-credit", undefined, "opt-default")
    expect(result).toBe("opt-default")
  })
})
