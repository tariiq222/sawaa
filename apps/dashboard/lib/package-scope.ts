/**
 * Package scope helpers — Sawaa Dashboard
 *
 * Pure (no React) translation between the scope-editor form shape
 * (`{ mode, ids }` per dimension) and the backend `constraints[]` contract,
 * plus the derived single-specific flags. Mirrors the backend
 * `package-constraints.helper.ts` so the UI can validate/summarise without a
 * round-trip.
 *
 * A dimension maps to a constraint dimension:
 *   service → SERVICE · practitioner → PRACTITIONER ·
 *   duration → DURATION · delivery → DELIVERY_TYPE.
 */

import type {
  PackageConstraintInput,
  PackageConstraintResponse,
} from "./types/package"
import type { PackageItemFormData, ScopeFormData } from "./schemas/package.schema"

const EMPTY_SCOPE: ScopeFormData = { mode: "ANY", ids: [] }

function isSingleInclude(scope: ScopeFormData): boolean {
  return scope.mode === "INCLUDE" && scope.ids.length === 1
}

/** True when the item pins one service + one practitioner + one duration (legacy-style). */
export function isSingleSpecificItem(item: {
  service: ScopeFormData
  practitioner: ScopeFormData
  duration: ScopeFormData
}): boolean {
  return (
    isSingleInclude(item.service) &&
    isSingleInclude(item.practitioner) &&
    isSingleInclude(item.duration)
  )
}

/** UI selection mode; legacy items infer flexibility from their scopes. */
export function isFlexibleItem(item: {
  selectionMode?: "FIXED" | "FLEXIBLE"
  service: ScopeFormData
  practitioner: ScopeFormData
  duration: ScopeFormData
}): boolean {
  return item.selectionMode === "FLEXIBLE" ||
    (item.selectionMode == null && !isSingleSpecificItem(item))
}

/**
 * Build the constraints payload from a form item. A duration remains useful
 * whenever a single service is selected, even if the practitioner is inherited
 * or intentionally flexible. Delivery is emitted only when constrained.
 */
export function scopesToConstraints(item: PackageItemFormData): PackageConstraintInput[] {
  if (item.originalConstraints) return item.originalConstraints
  const singleService = isSingleInclude(item.service)
  const out: PackageConstraintInput[] = [
    dimConstraint("SERVICE", item.service),
    dimConstraint("PRACTITIONER", item.practitioner),
    dimConstraint("DURATION", singleService ? item.duration : EMPTY_SCOPE),
  ]
  // Delivery is secondary — only send when actually constrained.
  if (item.delivery.mode !== "ANY") {
    out.push(dimConstraint("DELIVERY_TYPE", item.delivery))
  }
  return out
}

/** Preserve the exact constraint rows while an existing item remains untouched. */
export function responseConstraintsToInputs(
  constraints: PackageConstraintResponse[] | undefined,
): PackageConstraintInput[] | undefined {
  if (!constraints || constraints.length === 0) return undefined
  return constraints.map((constraint) => ({
    dimension: constraint.dimension,
    mode: constraint.mode,
    ...(constraint.mode === "ANY"
      ? {}
      : { targetIds: constraint.targets.map((target) => target.targetId) }),
  }))
}

function dimConstraint(
  dimension: PackageConstraintInput["dimension"],
  scope: ScopeFormData,
): PackageConstraintInput {
  if (scope.mode === "ANY") return { dimension, mode: "ANY" }
  return { dimension, mode: scope.mode, targetIds: scope.ids }
}

/**
 * Hydrate the scope-editor state from a GET response item. Prefers
 * `constraints`; falls back to the legacy triple (single-INCLUDE each) when the
 * server did not return constraints (older data / non-eager-loaded response).
 */
export function itemToScopes(item: {
  serviceId: string | null
  employeeId: string | null
  durationOptionId: string | null
  constraints?: PackageConstraintResponse[]
}): {
  service: ScopeFormData
  practitioner: ScopeFormData
  duration: ScopeFormData
  delivery: ScopeFormData
} {
  if (item.constraints && item.constraints.length > 0) {
    const byDim = new Map(item.constraints.map((c) => [c.dimension, c]))
    const scopeOf = (dim: PackageConstraintResponse["dimension"]): ScopeFormData => {
      const c = byDim.get(dim)
      if (!c || c.mode === "ANY") return { mode: "ANY", ids: [] }
      return { mode: c.mode, ids: c.targets.map((t) => t.targetId) }
    }
    return {
      service: scopeOf("SERVICE"),
      practitioner: scopeOf("PRACTITIONER"),
      duration: scopeOf("DURATION"),
      delivery: scopeOf("DELIVERY_TYPE"),
    }
  }

  // Legacy fallback: synthesise single-INCLUDE scopes from the triple.
  const single = (id: string | null): ScopeFormData =>
    id ? { mode: "INCLUDE", ids: [id] } : { mode: "ANY", ids: [] }
  return {
    service: single(item.serviceId),
    practitioner: single(item.employeeId),
    duration: single(item.durationOptionId),
    delivery: { mode: "ANY", ids: [] },
  }
}
