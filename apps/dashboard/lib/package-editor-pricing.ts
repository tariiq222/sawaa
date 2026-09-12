import type { ScopeFormData } from "./schemas/package.schema"

export type DerivedPriceState = "available" | "pending" | "unavailable"

export type PackageEditorSelectionMode = "FIXED" | "FLEXIBLE"

interface PackageEditorModeTransitionInput {
  currentMode: PackageEditorSelectionMode
  nextMode: PackageEditorSelectionMode
  service: ScopeFormData
  practitioner: ScopeFormData
  duration: ScopeFormData
  ownerEmployeeId?: string | null
}

export interface PackageEditorModeTransition {
  service: ScopeFormData
  practitioner: ScopeFormData
  duration: ScopeFormData
  clearPrice: boolean
}

const anyScope = (): ScopeFormData => ({ mode: "ANY", ids: [] })
const emptyIncludeScope = (scope: ScopeFormData): boolean =>
  scope.mode === "INCLUDE" && scope.ids.length === 0

/** Apply an explicit FIXED/FLEXIBLE switch without changing same-mode data. */
export function transitionPackageEditorMode(
  input: PackageEditorModeTransitionInput,
): PackageEditorModeTransition {
  if (input.currentMode === input.nextMode) {
    return {
      service: input.service,
      practitioner: input.practitioner,
      duration: input.duration,
      clearPrice: false,
    }
  }

  const switchingToFlexible = input.nextMode === "FLEXIBLE"
  const switchingToFixed = input.nextMode === "FIXED"
  const practitioner = input.ownerEmployeeId
    ? { mode: "INCLUDE" as const, ids: [input.ownerEmployeeId] }
    : switchingToFlexible && emptyIncludeScope(input.practitioner)
      ? anyScope()
      : switchingToFixed && input.practitioner.mode === "ANY"
        ? { mode: "INCLUDE" as const, ids: [] }
        : input.practitioner

  return {
    service:
      switchingToFlexible && emptyIncludeScope(input.service)
        ? anyScope()
        : switchingToFixed && input.service.mode === "ANY"
          ? { mode: "INCLUDE" as const, ids: [] }
          : input.service,
    practitioner,
    duration:
      switchingToFlexible
        ? anyScope()
        : switchingToFixed && input.duration.mode === "ANY"
          ? { mode: "INCLUDE" as const, ids: [] }
          : input.duration,
    clearPrice: switchingToFixed,
  }
}

export function derivedPriceState(input: { singleSpecific: boolean; hasHistoricalOverride: boolean; loading: boolean; selected: boolean }): DerivedPriceState {
  if (!input.singleSpecific || input.hasHistoricalOverride || input.selected) return "available"
  return input.loading ? "pending" : "unavailable"
}

/** A deliberate valid duration change invalidates a saved fixed override. */
export function shouldResetHistoricalUnitPrice(previousDurationId: string | undefined, nextDurationId: string | undefined, hasOverride: boolean, nextDurationResolved: boolean): boolean {
  return hasOverride && !!nextDurationId && previousDurationId !== nextDurationId && nextDurationResolved
}
