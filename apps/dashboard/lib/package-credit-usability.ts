/**
 * Package credit usability predicates — Sawaa Dashboard
 *
 * Pure (no React, no "use client", no network, no imports from
 * `components/` or `hooks/`) predicates used by every UI surface that
 * renders a client's package credits. Centralised here so the wizard
 * `PackageCreditPicker`, the post-client-pick `ClientCreditsPanel`, and
 * any future display share a SINGLE source of truth for what makes a
 * credit jump-fillable, what makes it flexible, and how to dedupe a
 * list of credits.
 *
 * UI consumers:
 *   - apps/dashboard/components/features/bookings/wizard-steps/package-credit-picker.tsx
 *   - apps/dashboard/components/features/bookings/client-credits-panel.tsx
 *
 * A credit is PINNED when `serviceId`/`employeeId`/`durationOptionId`
 * are all populated and the backend has resolved a concrete
 * `categoryId`; the wizard can "jump" the operator straight to the
 * matching booking step in that case. A FLEXIBLE / rule-based credit
 * carries no pinned service — its eligibility lives in `constraints`
 * rows, so the backend yields `categoryId: null` and blank display
 * names, and the wizard must RESTRICT its option lists instead of
 * jumping.
 */

import type { PackageCredit } from "./types/package-purchase"

/**
 * True only when the backend resolved a concrete `categoryId` AND the
 * triple `(serviceId, employeeId, durationOptionId)` is fully populated
 * AND the service/practitioner is still bookable. The wizard's
 * `CreditTarget` contract requires five concrete ids, so only such a
 * credit can jump-fill. Narrowing the four ids in the return type means
 * `buildCreditTarget` (and its inlined equivalent in the panel) read
 * them without any non-null assertion.
 */
export function isJumpableCredit(
  credit: PackageCredit,
): credit is PackageCredit & {
  categoryId: string; serviceId: string; employeeId: string; durationOptionId: string
} {
  return (
    credit.categoryId != null &&
    credit.serviceId != null &&
    credit.employeeId != null &&
    credit.durationOptionId != null &&
    credit.serviceIsBookable
  )
}

/**
 * True when the credit carries no pinned service — a rule-based credit
 * whose eligibility lives in its `constraints` rows. The two UI
 * surfaces both gate their FLEXIBLE label branch on this flag.
 *
 * Intentionally uses `credit.categoryId == null` (NOT `!credit.serviceId`)
 * to match the branch condition the components used BEFORE this
 * extraction. These two definitions DIVERGE on a malformed hybrid row
 * whose backend resolution produced a `categoryId` but left
 * `serviceId` null — the existing UI treats such a row as pinned-but-
 * inactive (renders the "not bookable" label), and this module must not
 * silently change which one the UI applies. The constraint predicate in
 * `lib/credit-constraints.ts` (`isFlexibleCredit`) uses the other
 * definition (`!serviceId`) because matching that helper runs on
 * `MatchableCredit` shapes that may not carry `categoryId` at all.
 */
export function isFlexiblePackageCredit(credit: PackageCredit): boolean {
  return credit.categoryId == null
}

/**
 * Stable dedupe key. PINNED credits collapse on their
 * `(serviceId, employeeId, durationOptionId)` triple, keeping the first.
 * FLEXIBLE credits have an all-null triple, so they would all collapse
 * onto the constant `"null:null:null"` — a client holding two flexible
 * packages would only ever see one. Falling back to `credit.id` for
 * flexible rows keeps each one's card visible.
 */
export function creditDedupeKey(credit: PackageCredit): string {
  if (credit.serviceId && credit.employeeId && credit.durationOptionId) {
    return `${credit.serviceId}:${credit.employeeId}:${credit.durationOptionId}`
  }
  return `credit:${credit.id}`
}

/**
 * Drop exhausted credits, then dedupe with `creditDedupeKey` keeping
 * the first occurrence. Pure — does not mutate the input. The picker
 * applies this once per `PackagePurchase`; the panel applies it once
 * across the flattened purchase × credit list.
 */
export function filterUsableCredits(credits: PackageCredit[]): PackageCredit[] {
  const seen = new Set<string>()
  const out: PackageCredit[] = []
  for (const credit of credits) {
    if (credit.remaining <= 0) continue
    const key = creditDedupeKey(credit)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(credit)
  }
  return out
}