/**
 * Credit constraint matching — Sawaa Dashboard
 *
 * Pure (no React, no network, no side effects) mirror of the backend
 * `package-credit-matching.helper.ts`. Every rule here MUST stay identical to
 * the backend; the only deliberate divergence is `creditStillViable`, which
 * tolerates an undecided target value (see its doc).
 *
 * Wire contract (`PackageCreditConstraint`):
 *   dimension: SERVICE | PRACTITIONER | DURATION | DELIVERY_TYPE
 *   mode:      ANY | INCLUDE | EXCLUDE
 *   targetIds: string[]   // flattened from targets[].targetId; empty for ANY
 *
 * Rules:
 *   ANY      → always passes (a dimension with no row is also ANY).
 *   INCLUDE  → the value must be one of the constraint's targetIds.
 *   EXCLUDE  → the value must NOT be one of the constraint's targetIds.
 *   For INCLUDE/EXCLUDE, a `null` value FAILS (only ANY tolerates null).
 *   Multiple rows on the same dimension apply conjunctively.
 */

import type {
  CreditConstraintDimension,
  PackageCreditConstraint,
} from "./types/package-purchase"

/** The subset of a credit that matching cares about. */
export interface MatchableCredit {
  constraints: PackageCreditConstraint[]
  serviceId?: string | null
  employeeId?: string | null
  durationOptionId?: string | null
}

/** The booking the operator is assembling. Any field may still be unpicked. */
export interface PartialBookingTarget {
  serviceId?: string | null
  employeeId?: string | null
  durationOptionId?: string | null
  deliveryType?: string | null
}

function rowsFor(
  credit: MatchableCredit,
  dimension: CreditConstraintDimension,
): PackageCreditConstraint[] {
  return effectiveConstraints(credit).filter((c) => c.dimension === dimension)
}

/** True when the credit is rule-based (no pinned service). */
export function isFlexibleCredit(credit: MatchableCredit): boolean {
  return !credit.serviceId
}

/**
 * Mirrors backend `effectiveConstraints`: snapshot rules win; otherwise
 * synthesise INCLUDE constraints from the legacy triple, skipping null
 * members. A fully empty credit (no rows, null triple) returns [].
 */
export function effectiveConstraints(credit: MatchableCredit): PackageCreditConstraint[] {
  if (credit.constraints.length > 0) return credit.constraints
  const synthetic: PackageCreditConstraint[] = []
  if (credit.serviceId) {
    synthetic.push({ dimension: "SERVICE", mode: "INCLUDE", targetIds: [credit.serviceId] })
  }
  if (credit.employeeId) {
    synthetic.push({ dimension: "PRACTITIONER", mode: "INCLUDE", targetIds: [credit.employeeId] })
  }
  if (credit.durationOptionId) {
    synthetic.push({ dimension: "DURATION", mode: "INCLUDE", targetIds: [credit.durationOptionId] })
  }
  return synthetic
}

/**
 * Allowed ids for one dimension. Returns `null` when the dimension is
 * UNRESTRICTED (mode ANY, or no row at all) — callers must treat null as
 * "show everything", NOT as "show nothing". Returns a Set of allowed ids for
 * INCLUDE. Returns `null` for EXCLUDE (use `blockedTargets` for that).
 *
 * Defensive: if multiple INCLUDE rows exist on the same dimension, the result
 * is the intersection (id must be in every INCLUDE row). EXCLUDE rows on the
 * same dimension are exposed via `blockedTargets`, not folded into the allowed
 * set.
 */
export function allowedTargets(
  credit: MatchableCredit,
  dimension: CreditConstraintDimension,
): Set<string> | null {
  const includeRows = rowsFor(credit, dimension).filter((r) => r.mode === "INCLUDE")
  if (includeRows.length === 0) return null
  const [first, ...rest] = includeRows
  const out = new Set(first.targetIds)
  for (const row of rest) {
    const rowSet = new Set(row.targetIds)
    for (const id of out) if (!rowSet.has(id)) out.delete(id)
  }
  return out
}

/** Blocked ids for one dimension (union of EXCLUDE rows). Null when no EXCLUDE row applies. */
export function blockedTargets(
  credit: MatchableCredit,
  dimension: CreditConstraintDimension,
): Set<string> | null {
  const rows = rowsFor(credit, dimension).filter((r) => r.mode === "EXCLUDE")
  if (rows.length === 0) return null
  const out = new Set<string>()
  for (const row of rows) for (const id of row.targetIds) out.add(id)
  return out
}

function rowPasses(
  row: PackageCreditConstraint,
  id: string | null | undefined,
): boolean {
  if (row.mode === "ANY") return true
  if (id == null) return false
  if (row.mode === "INCLUDE") return row.targetIds.includes(id)
  if (row.mode === "EXCLUDE") return !row.targetIds.includes(id)
  return false
}

/**
 * Single-dimension predicate mirroring backend `dimensionPasses`.
 * ANY (or no row) -> true. INCLUDE/EXCLUDE with a null id -> false.
 * Multiple rows on the same dimension apply conjunctively.
 */
export function isAllowedOnDimension(
  credit: MatchableCredit,
  dimension: CreditConstraintDimension,
  id: string | null | undefined,
): boolean {
  const rows = rowsFor(credit, dimension)
  if (rows.length === 0) return true
  return rows.every((r) => rowPasses(r, id))
}

/**
 * Filter a list of options down to those the credit permits on one dimension.
 * Generic over the option shape via an id selector, so it works for services,
 * employees, and duration options alike. Unrestricted dimension -> same list
 * contents (a shallow copy, never the same reference).
 */
export function filterByConstraint<T>(
  credit: MatchableCredit,
  dimension: CreditConstraintDimension,
  options: readonly T[],
  getId: (option: T) => string,
): T[] {
  const rows = rowsFor(credit, dimension)
  if (rows.length === 0) return options.slice()
  return options.filter((opt) => rows.every((r) => rowPasses(r, getId(opt))))
}

function targetValue(
  target: PartialBookingTarget,
  dimension: CreditConstraintDimension,
): string | null | undefined {
  switch (dimension) {
    case "SERVICE":       return target.serviceId
    case "PRACTITIONER":  return target.employeeId
    case "DURATION":      return target.durationOptionId
    case "DELIVERY_TYPE": return target.deliveryType
    default:              return undefined
  }
}

/**
 * Whole-target predicate mirroring backend `creditMatchesTarget`, but tolerant
 * of a partially-filled target: a dimension whose target value is still
 * null/undefined is treated as UNDECIDED and does NOT fail the match. Use this
 * to decide whether a credit is still viable mid-wizard.
 *
 * Divergence from backend: an undecided target value is tolerated here. Final
 * enforcement is the backend's `book-from-credit`, where every dimension must
 * have a concrete value before the match is checked. Every other rule (ANY
 * pass-through, INCLUDE/EXCLUDE semantics, null id failing INCLUDE/EXCLUDE,
 * conjunctive multiple rows) is identical.
 */
export function creditStillViable(
  credit: MatchableCredit,
  target: PartialBookingTarget,
): boolean {
  for (const row of effectiveConstraints(credit)) {
    const value = targetValue(target, row.dimension)
    if (value == null) continue // UNDECIDED — tolerated, not failed.
    if (!rowPasses(row, value)) return false
  }
  return true
}

/** Mirrors backend `specificityScore`: number of non-ANY effective constraints. Higher = narrower. */
export function specificityScore(credit: MatchableCredit): number {
  return effectiveConstraints(credit).filter((c) => c.mode !== "ANY").length
}
