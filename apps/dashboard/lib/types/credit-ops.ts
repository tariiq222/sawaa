/**
 * Credit Operations Types — Sawaa Dashboard
 *
 * App-local types for the Phase 5 session-packages operator mutations:
 *   - POST /dashboard/bookings/credits/:creditId/transfer
 *   - POST /dashboard/finance/package-purchases/:purchaseId/refund
 *
 * Both endpoints are operator-only:
 *   - transfer  → gated by `manage:Booking` (OWNER/ADMIN/MANAGER) per the
 *                 bookings.controller.ts `transferCredit` handler.
 *   - refund    → gated by `manage:Setting` (OWNER/ADMIN, NOT ACCOUNTANT) per
 *                 finance.controller.ts `refundPackagePurchaseEndpoint`.
 *
 * Money is integer halalas end-to-end. The refund modal accepts a
 * SAR-major amount from the operator and converts to halalas before
 * posting (see `sarToHalalas` in lib/money).
 */

import type { PackageCredit } from "./package-purchase"

/* ─── Transfer credit ─── */

/**
 * Body of `POST /dashboard/bookings/credits/:creditId/transfer`. The
 * creditId travels in the URL; the body carries only the target
 * practitioner. The backend re-validates that the target offers the
 * SAME service+duration option, so a mismatch returns 400.
 */
export interface TransferCreditPayload {
  toEmployeeId: string
}

/**
 * Server response from the transfer endpoint. The backend returns the
 * freshly-updated credit row (id + new employeeId) — the dashboard
 * only needs these two fields to refresh the balances panel.
 */
export interface TransferCreditResult {
  id: string
  employeeId: string
}

/* ─── Refund package purchase ─── */

/**
 * Body of `POST /dashboard/finance/package-purchases/:purchaseId/refund`.
 * `refundAmount` is integer halalas; `notes` is optional (≤1000 chars).
 * Setting `refundAmount` to 0 records a no-money cancellation: the
 * purchase is still marked REFUNDED and the credits are still voided.
 */
export interface RefundPackagePurchasePayload {
  refundAmount: number
  notes?: string
}

/**
 * Server response from the refund endpoint.
 */
export interface RefundPackagePurchaseResult {
  purchaseId: string
  status: "REFUNDED"
  refundAmount: number
  refundedAt: string
}

/* ─── Employee picker shape ─── */

/**
 * Subset of the `useServiceEmployees` row used by the transfer dialog
 * — the operator only needs the practitioner's id, display name, and
 * active flag to populate the selector.
 */
export interface ServiceEmployeeOption {
  id: string
  /** Formatted display name (typically the employee's `name`/`nameAr`). */
  displayName: string
  isActive: boolean
  /** Raw row re-exposed so callers can read any extra fields they want. */
  raw: unknown
}

/* ─── Helper: select the right employees for a credit ─── */

/**
 * Defensive narrowing: the caller is `useServiceEmployees(credit.serviceId)`
 * and we only want practitioners other than the current owner who are
 * currently active. The backend re-validates this on submit, but
 * filtering the picker client-side keeps the form friendly.
 */
export function pickTransferTargetEmployees(
  rows: ServiceEmployeeOption[] | undefined,
  currentOwnerEmployeeId: string,
): ServiceEmployeeOption[] {
  if (!rows) return []
  return rows.filter(
    (row) => row.isActive && row.id !== currentOwnerEmployeeId,
  )
}

/* ─── Re-export ─── */
export type { PackageCredit }
