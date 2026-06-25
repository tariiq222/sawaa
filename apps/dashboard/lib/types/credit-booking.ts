/**
 * Credit Booking Types — Sawaa Dashboard
 *
 * App-local types for the Phase 3 session-packages consumption
 * endpoints (POST /dashboard/bookings/from-credit,
 * GET /dashboard/bookings/matching-credits). Mirrors the backend
 * `BookFromCreditDto` and `MatchingCredit` shapes.
 *
 * The credit booking carries NO invoice and NO payment (price = 0);
 * the client pre-paid in full at purchase time. Duration is FIXED by
 * the credit and the caller cannot change it.
 */

/* ─── Matching credit (read-only suggestion source) ─── */

/**
 * One row of `GET /dashboard/bookings/matching-credits`. Mirrors the
 * backend `MatchingCredit` type exactly — every credit bucket that
 * matches the (serviceId, employeeId, durationOptionId) triple for an
 * ACTIVE purchase and still has remaining capacity, in FIFO order.
 */
export interface MatchingCredit {
  creditId: string
  purchaseId: string
  serviceId: string
  employeeId: string
  durationOptionId: string
  totalQuantity: number
  usedQuantity: number
  remaining: number
  /** ISO timestamp. */
  createdAt: string
}

/* ─── Queries ─── */

export interface MatchingCreditsQuery {
  clientId: string
  serviceId: string
  employeeId: string
  durationOptionId: string
}

/* ─── Write side ─── */

export type DeliveryType = "IN_PERSON" | "ONLINE"

/**
 * Body of `POST /dashboard/bookings/from-credit`. Mirrors the backend
 * `BookFromCreditDto`. The duration is FIXED by the credit, so the
 * caller never sends a duration. Either `creditId` OR the full triple
 * (serviceId, employeeId, durationOptionId) is required — the DTO uses
 * `@ValidateIf` so omitting `creditId` makes the triple required and
 * vice versa.
 */
export interface BookFromCreditPayload {
  clientId: string
  /** Explicit PackageCredit bucket to consume. */
  creditId?: string
  /** Required when `creditId` is omitted. */
  serviceId?: string
  /** Required when `creditId` is omitted. */
  employeeId?: string
  /** Required when `creditId` is omitted. */
  durationOptionId?: string
  branchId: string
  /** ISO 8601 datetime, must be in the future. */
  scheduledAt: string
  /** Defaults to the credit's duration-option delivery type. */
  deliveryType?: DeliveryType
  notes?: string
}