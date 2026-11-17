/**
 * Credit Operations Types — Sawaa Dashboard
 *
 * App-local types for the Phase 5 session-packages operator mutations:
 *   - POST /dashboard/bookings/credits/:creditId/transfer
 *   - POST /dashboard/finance/package-purchases/:purchaseId/refund
 *
 * Both endpoints are operator-only:
 *   - transfer  → gated by `manage:Booking` (OWNER/ADMIN/MANAGER)
 *   - refund    → gated by `manage:Refund` (OWNER/ADMIN)
 *
 * Response/body shapes are DERIVED from the committed OpenAPI snapshot
 * (documented by the bookings and finance controllers respectively). Money is
 * integer halalas end-to-end; the refund modal converts SAR at the form layer
 * (see `sarToHalalas` in lib/money).
 */

import type { components } from "@/lib/types/api.generated"
import type { PackageCredit } from "./package-purchase"

type Schemas = components["schemas"]

/* ─── Vocabulary ─── */

/** Delivery channel, as the snapshot documents it. */
export type DeliveryType = NonNullable<Schemas["BookFromCreditDto"]["deliveryType"]>

/* ─── Transfer credit ─── */

/**
 * Body of `POST /dashboard/bookings/credits/:creditId/transfer`
 * (`TransferCreditDto`). The creditId travels in the URL; the body carries
 * only the target practitioner. The backend re-validates that the target
 * offers the SAME service+duration option, so a mismatch returns 400.
 */
export type TransferCreditPayload = Schemas["TransferCreditDto"]

/**
 * Server response from the transfer endpoint (`PackageCreditRecordDto`). The
 * backend returns the freshly-updated credit row (id + new employeeId) — the
 * dashboard only needs these two fields to refresh the balances panel.
 */
export type TransferCreditResult = Schemas["PackageCreditRecordDto"]

/* ─── Refund package purchase ─── */

/**
 * Body of `POST /dashboard/finance/package-purchases/:purchaseId/refund`
 * (`RefundPackagePurchaseDto`). `refundAmount` is integer halalas; `notes` is
 * optional (≤1000 chars). Setting `refundAmount` to 0 records a no-money
 * cancellation: the purchase is still marked REFUNDED and the credits voided.
 */
export type RefundPackagePurchasePayload = Schemas["RefundPackagePurchaseDto"]

/** Server response from the refund endpoint (`PackagePurchaseRefundResponseDto`). */
export type RefundPackagePurchaseResult = Schemas["PackagePurchaseRefundResponseDto"]

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
  effectiveDurations?: Array<{
    deliveryType: DeliveryType
    durations: Array<{ id: string; durationMins: number; labelAr: string; label: string }>
  }>
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
