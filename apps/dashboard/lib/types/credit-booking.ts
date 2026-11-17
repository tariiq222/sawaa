/**
 * Credit Booking Types — Sawaa Dashboard
 *
 * App-local types for the Phase 3 session-packages consumption endpoints
 * (POST /dashboard/bookings/from-credit, GET /dashboard/bookings/matching-credits).
 *
 * Those routes belong to the bookings controller (MNT-08 bookings unit), not to
 * finance. Their wire shapes ARE documented there, so the response/body shapes
 * are derived from the committed OpenAPI snapshot here; only the dashboard's
 * own query object stays local.
 *
 * The credit booking carries NO invoice and NO payment (price = 0); the client
 * pre-paid in full at purchase time. Duration is FIXED by the credit and the
 * caller cannot change it.
 */

import type { components } from "@/lib/types/api.generated"
import type { DeliveryType } from "./credit-ops"

type Schemas = components["schemas"]

/* ─── Matching credit (read-only suggestion source) ─── */

/**
 * One row of `GET /dashboard/bookings/matching-credits` (`MatchingCreditDto`):
 * every credit bucket that matches the (serviceId, employeeId,
 * durationOptionId) triple for an ACTIVE purchase with remaining capacity, in
 * FIFO order.
 */
export type MatchingCredit = Schemas["MatchingCreditDto"]

/** `POST /dashboard/bookings/from-credit` body (`BookFromCreditDto`). */
export type BookFromCreditPayload = Schemas["BookFromCreditDto"]

/* ─── Queries (client-side) ─── */

export interface MatchingCreditsQuery {
  clientId: string
  serviceId: string
  employeeId: string
  durationOptionId: string
  deliveryType?: DeliveryType
}
