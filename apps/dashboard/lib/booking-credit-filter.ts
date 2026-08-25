/**
 * Booking credit filter — Sawaa Dashboard
 *
 * Pure (no React, no "use client", no network) predicate factory that lets a
 * FLEXIBLE (rule-based) package credit RESTRICT the booking wizard. The wizard
 * normally offers every service, every practitioner, every duration, and every
 * delivery type; when the operator spends a flexible credit, this module narrows
 * those lists down to only what the credit's constraints permit.
 *
 * Design rule (decided by the architect, not negotiable): every dimension is
 * filtered with a SINGLE BOOLEAN PREDICATE built on
 * `isAllowedOnDimension`. This module therefore exposes four standalone
 * predicates plus one bound-predicate bundle, and it does NOT expose
 * `allowedTargets` / `blockedTargets` (whose `null` return values conflate
 * three different "everything is fine" cases).
 *
 * No state mutation: the `constraints` array passed to `buildCreditFilter` is
 * copied so the caller can mutate its own copy without leaking state in here.
 * `undefined` triple members are normalised to `null` so downstream
 * `effectiveConstraints` synthesis (which skips falsy values) sees a stable
 * shape regardless of how the caller modelled the legacy fields.
 */

import type { PackageCreditConstraint } from "./types/package-purchase"
import { isAllowedOnDimension } from "./credit-constraints"

/**
 * A flexible package credit the operator chose to spend. Carries everything the
 * wizard needs to (a) restrict the option lists and (b) prove which purchase and
 * credit the resulting booking consumed.
 */
export interface CreditFilter {
  packagePurchaseId: string
  creditId: string
  /** Localized package name, shown in the "restricted to package: X" chip. */
  packageName: string
  constraints: PackageCreditConstraint[]
  /**
   * Legacy triple, null on a truly flexible credit. Kept so
   * `effectiveConstraints` can synthesise rules for legacy credits.
   */
  serviceId: string | null
  employeeId: string | null
  durationOptionId: string | null
}

/**
 * Source shape accepted by `buildCreditFilter` — structural, so it fits both
 * the current and the widened `PackageCredit`.
 */
export interface CreditFilterSource {
  id: string
  constraints: PackageCreditConstraint[]
  serviceId?: string | null
  employeeId?: string | null
  durationOptionId?: string | null
}

/**
 * Build an immutable `CreditFilter` from a credit row. Copies `constraints`
 * (the caller may still mutate its own array afterwards) and normalises an
 * `undefined` legacy triple member to `null`.
 */
export function buildCreditFilter(
  credit: CreditFilterSource,
  packagePurchaseId: string,
  packageName: string,
): CreditFilter {
  return {
    packagePurchaseId,
    creditId: credit.id,
    packageName,
    constraints: credit.constraints.slice(),
    serviceId: credit.serviceId ?? null,
    employeeId: credit.employeeId ?? null,
    durationOptionId: credit.durationOptionId ?? null,
  }
}

/** Predicate: may the operator pick this service under the filter? */
export function isServiceAllowed(
  filter: CreditFilter | null,
  serviceId: string,
): boolean {
  if (!filter) return true
  return isAllowedOnDimension(filter, "SERVICE", serviceId)
}

/** Predicate: may the operator pick this practitioner under the filter? */
export function isEmployeeAllowed(
  filter: CreditFilter | null,
  employeeId: string,
): boolean {
  if (!filter) return true
  return isAllowedOnDimension(filter, "PRACTITIONER", employeeId)
}

/** Predicate: may the operator pick this duration option under the filter? */
export function isDurationAllowed(
  filter: CreditFilter | null,
  durationOptionId: string,
): boolean {
  if (!filter) return true
  return isAllowedOnDimension(filter, "DURATION", durationOptionId)
}

/** Predicate: may the operator pick this delivery type under the filter? */
export function isDeliveryTypeAllowed(
  filter: CreditFilter | null,
  deliveryType: string,
): boolean {
  if (!filter) return true
  return isAllowedOnDimension(filter, "DELIVERY_TYPE", deliveryType)
}

/**
 * Bound predicate bundle for a filter, so a rendering component can pass one
 * ready-made function per dimension into a wizard step without re-deriving.
 * Returns `null` when `filter` is null, meaning "no restriction at all".
 */
export function creditFilterPredicates(filter: CreditFilter | null): {
  isServiceAllowed: (serviceId: string) => boolean
  isEmployeeAllowed: (employeeId: string) => boolean
  isDurationAllowed: (durationOptionId: string) => boolean
  isDeliveryTypeAllowed: (deliveryType: string) => boolean
} | null {
  if (!filter) return null
  return {
    isServiceAllowed: (serviceId: string) => isServiceAllowed(filter, serviceId),
    isEmployeeAllowed: (employeeId: string) => isEmployeeAllowed(filter, employeeId),
    isDurationAllowed: (durationOptionId: string) =>
      isDurationAllowed(filter, durationOptionId),
    isDeliveryTypeAllowed: (deliveryType: string) =>
      isDeliveryTypeAllowed(filter, deliveryType),
  }
}
