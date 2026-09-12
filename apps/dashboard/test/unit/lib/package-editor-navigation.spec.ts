import { describe, expect, it } from "vitest"
import { firstPackageStep, packageStepForPath } from "@/lib/package-editor-navigation"
import { prunePackageLineDetails } from "@/lib/package-editor-lines"
import { derivedPriceState, shouldResetHistoricalUnitPrice, transitionPackageEditorMode } from "@/lib/package-editor-pricing"
import { packageEmployeeLabel } from "@/lib/package-editor-labels"

describe("package editor error routing", () => {
  it("routes owner, scope and pricing paths to their fixing step", () => {
    expect(packageStepForPath("ownerEmployeeId")).toBe(1)
    expect(packageStepForPath("items.0.service.ids")).toBe(2)
    expect(packageStepForPath("items.0.duration.mode")).toBe(2)
    expect(packageStepForPath("items.0.discountValue")).toBe(3)
  })

  it("chooses the earliest step when several fields are invalid", () => {
    expect(firstPackageStep(["items.0.discountValue", "nameAr"])).toBe(1)
    expect(firstPackageStep(["items.0.unitPriceSar", "items.0.service.ids"])).toBe(2)
  })
})

describe("package review line details", () => {
  it("prunes removed middle or trailing rows without retaining stale indexes", () => {
    const detail = (name: string) => ({ serviceName: name, practitionerName: name, durationName: name, deliveryName: name, paidQuantity: 1, freeQuantity: 0, unitPrice: 100, discountType: null, discountValue: 0, discountAmount: 0, net: 100 })
    expect(Object.keys(prunePackageLineDetails({ 0: detail("a"), 1: detail("b"), 2: detail("c") }, 2))).toEqual(["0", "1"])
  })
})


describe("package derived pricing decisions", () => {
  it("resets a saved override only after a deliberate resolved duration change", () => {
    expect(shouldResetHistoricalUnitPrice("old", "new", true, true)).toBe(true)
    expect(shouldResetHistoricalUnitPrice("old", "new", false, true)).toBe(false)
    expect(shouldResetHistoricalUnitPrice("old", "old", true, true)).toBe(false)
    expect(shouldResetHistoricalUnitPrice("old", "new", true, false)).toBe(false)
  })

  it("distinguishes pending and unavailable derived prices from explicit zero overrides", () => {
    expect(derivedPriceState({ singleSpecific: true, hasHistoricalOverride: false, loading: true, selected: false })).toBe("pending")
    expect(derivedPriceState({ singleSpecific: true, hasHistoricalOverride: false, loading: false, selected: false })).toBe("unavailable")
    expect(derivedPriceState({ singleSpecific: true, hasHistoricalOverride: true, loading: false, selected: false })).toBe("available")
  })

  it("makes an untouched fixed row flexible without leaving incomplete INCLUDE scopes", () => {
    expect(transitionPackageEditorMode({
      currentMode: "FIXED",
      nextMode: "FLEXIBLE",
      service: { mode: "INCLUDE", ids: [] },
      practitioner: { mode: "INCLUDE", ids: [] },
      duration: { mode: "INCLUDE", ids: [] },
    })).toEqual({
      service: { mode: "ANY", ids: [] },
      practitioner: { mode: "ANY", ids: [] },
      duration: { mode: "ANY", ids: [] },
      clearPrice: false,
    })
  })

  it("preserves populated flexible scopes and clears its manual price when fixed", () => {
    const service = { mode: "INCLUDE" as const, ids: ["service-1"] }
    const practitioner = { mode: "ANY" as const, ids: [] }
    const duration = { mode: "ANY" as const, ids: [] }
    expect(transitionPackageEditorMode({ currentMode: "FIXED", nextMode: "FLEXIBLE", service, practitioner, duration })).toEqual({ service, practitioner, duration: { mode: "ANY", ids: [] }, clearPrice: false })
    expect(transitionPackageEditorMode({ currentMode: "FLEXIBLE", nextMode: "FIXED", service, practitioner, duration })).toEqual({ service, practitioner: { mode: "INCLUDE", ids: [] }, duration: { mode: "INCLUDE", ids: [] }, clearPrice: true })
  })

  it("leaves a same-mode click untouched and keeps an owner as practitioner", () => {
    const service = { mode: "INCLUDE" as const, ids: ["service-1"] }
    const practitioner = { mode: "ANY" as const, ids: [] }
    const duration = { mode: "ANY" as const, ids: [] }
    expect(transitionPackageEditorMode({ currentMode: "FLEXIBLE", nextMode: "FLEXIBLE", service, practitioner, duration, ownerEmployeeId: "owner-1" })).toEqual({ service, practitioner, duration, clearPrice: false })
    expect(transitionPackageEditorMode({ currentMode: "FIXED", nextMode: "FLEXIBLE", service: { mode: "INCLUDE", ids: [] }, practitioner: { mode: "INCLUDE", ids: [] }, duration: { mode: "INCLUDE", ids: [] }, ownerEmployeeId: "owner-1" }).practitioner).toEqual({ mode: "INCLUDE", ids: ["owner-1"] })
  })
})

describe("package editor labels", () => {
  it("uses API names before falling back to localized unavailable", () => {
    expect(packageEmployeeLabel({ name: "Seeded practitioner" }, "Unavailable")).toBe("Seeded practitioner")
    expect(packageEmployeeLabel({ firstName: "First", lastName: "Last" }, "Unavailable")).toBe("First Last")
    expect(packageEmployeeLabel({ id: "employee-id" }, "Unavailable")).toBe("Unavailable")
  })
})
