import { describe, expect, it } from "vitest"
import { buildGroupedPackagePayload, dependencyOptions, formDiscountToPayload, groupedFormDefaults, groupedPricePreview, groupsToPayload, packageSubmitIssues } from "@/lib/package-groups-form"
import type { SessionPackage } from "@/lib/types/package"
import { groupedPackageSchema } from "@/lib/schemas/package-groups.schema"

const form = {
  nameAr: "باقة",
  nameEn: "Pack",
  descriptionAr: "",
  descriptionEn: "",
  imageUrl: null,
  iconName: null,
  iconBgColor: null,
  sortOrder: 0,
  isActive: true,
  isPublic: false,
  groups: [{ key: "g1", label: "First", serviceId: "service-1", employeeId: "employee-1", sequenceMode: "ORDERED" as const, dependsOnGroupKey: null, sessionMode: "DETAIL" as const, sessions: [
    { key: "s1", position: 0, durationOptionId: "duration-1", deliveryType: "IN_PERSON" as const, unitPriceSar: 100, hasUnitPriceOverride: false },
    { key: "s2", position: 1, durationOptionId: "duration-2", deliveryType: "ONLINE" as const, unitPriceSar: 50, hasUnitPriceOverride: true },
  ] }],
  globalDiscount: { type: "FIXED" as const, value: 25 },
}

describe("grouped package form helpers", () => {
  it("keeps group and session ordering while converting prices to halalas", () => {
    expect(groupsToPayload(form.groups)).toEqual([{ key: "g1", label: "First", serviceId: "service-1", employeeId: "employee-1", sequenceMode: "ORDERED", dependsOnGroupKey: null, sessions: [
      { key: "s1", position: 0, durationOptionId: "duration-1", deliveryType: "IN_PERSON", unitPrice: 10000 },
      { key: "s2", position: 1, durationOptionId: "duration-2", deliveryType: "ONLINE", unitPrice: 5000 },
    ] }])
  })

  it("converts a total fixed discount from SAR to halalas", () => {
    expect(formDiscountToPayload({ type: "FIXED", value: 25 })).toEqual({ type: "FIXED", value: 2500 })
  })

  it("uses canonical allocation for the total preview", () => {
    const preview = groupedPricePreview(form)
    expect(preview.subtotal).toBe(15000)
    expect(preview.discountAmount).toBe(2500)
    expect(preview.amountPaid).toBe(12500)
    expect(preview.sessionNet.reduce((sum, value) => sum + value, 0)).toBe(12500)
  })

  it("marks an invalid fixed discount instead of showing an undiscounted preview", () => {
    const preview = groupedPricePreview({ groups: form.groups, globalDiscount: { type: "FIXED", value: 200 } })
    expect(preview.valid).toBe(false)
  })

  it("rejects duplicate keys, dependency cycles and discounts above subtotal", () => {
    const result = groupedPackageSchema.safeParse({ ...form, groups: [
      { ...form.groups[0], key: "duplicate", dependsOnGroupKey: "duplicate" },
      { ...form.groups[0], key: "duplicate", dependsOnGroupKey: "duplicate" },
    ], globalDiscount: { type: "FIXED", value: 200 } })
    expect(result.success).toBe(false)
  })

  it("does not expose dependency choices that would create a cycle", () => {
    const groups = [{ key: "g1", dependsOnGroupKey: "g2" }, { key: "g2", dependsOnGroupKey: null }, { key: "g3", dependsOnGroupKey: null }]
    expect(dependencyOptions(groups, "g2")).toEqual(["g3"])
    expect(dependencyOptions([
      { key: "g1", dependsOnGroupKey: "g2" },
      { key: "g2", dependsOnGroupKey: "g1" },
      { key: "g3", dependsOnGroupKey: null },
    ], "g3")).toEqual([])
  })

  it("hydrates grouped V2 and leaves legacy records on a fresh grouped form", () => {
    const v2 = groupedFormDefaults({ id: "p", modelVersion: "GROUPED_V2", groups: [{ key: "g1", serviceId: "s", employeeId: "e", sequenceMode: "ORDERED", dependsOnGroupKey: null, sessions: [{ key: "session-id", position: 0, durationOptionId: "d", deliveryType: "ONLINE", unitPrice: 1250 }] }], globalDiscount: { type: "PERCENTAGE", value: 10 }, nameAr: "باقة", nameEn: null, descriptionAr: null, descriptionEn: null, imageUrl: null, iconName: null, iconBgColor: null, sortOrder: 0, isActive: true, isPublic: false } as SessionPackage)
    expect(v2.groups[0].sessions[0].key).toBe("session-id")
    expect(v2.groups[0].sessions[0].unitPriceSar).toBe(12.5)
    expect(groupedFormDefaults({ modelVersion: "LEGACY" } as never).groups).toHaveLength(1)
  })

  it("sends an empty dependency selection as null", () => {
    const [group] = groupsToPayload([{ ...form.groups[0], dependsOnGroupKey: "" }])
    expect(group.dependsOnGroupKey).toBeNull()
  })

  it("normalizes an empty dependency to null in the form schema", () => {
    const result = groupedPackageSchema.safeParse({ ...form, groups: [{ ...form.groups[0], dependsOnGroupKey: "" }] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.groups[0].dependsOnGroupKey).toBeNull()
  })

  it("maps payload validation errors to translated field errors instead of raw JSON", () => {
    let thrown: unknown
    try { buildGroupedPackagePayload({ ...form, groups: [{ ...form.groups[0], dependsOnGroupKey: "missing-group" }] }) } catch (error) { thrown = error }
    const issues = packageSubmitIssues(thrown)
    expect(issues).toContainEqual({ path: "groups.0.dependsOnGroupKey", message: "packages.grouped.errors.dependency" })
    expect(issues?.every((issue) => issue.message.startsWith("packages."))).toBe(true)
    expect(packageSubmitIssues(new Error("Network down"))).toBeNull()
  })
})
