/**
 * Credit Bookings API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 3 session-packages consumption
 * endpoints (POST /dashboard/bookings/from-credit,
 * GET /dashboard/bookings/matching-credits). Mirrors the conventions
 * of `lib/api/packages.ts` and `lib/api/bookings.ts` — uses the shared
 * `api` instance so cookie-bearing refresh + envelope-unwrap are
 * inherited for free.
 *
 * The body for `bookFromCredit` matches the backend DTO verbatim:
 * `scheduledAt` is sent as ISO 8601; the controller converts it to a
 * Date. Duration is fixed by the chosen credit, so the caller never
 * sends a duration.
 */

import { api } from "@/lib/api"
import type {
  BookFromCreditPayload,
  MatchingCredit,
  MatchingCreditsQuery,
} from "@/lib/types/credit-booking"

/**
 * Find a client's usable session-package credits that match the exact
 * (service, employee, durationOptionId) triple, in FIFO order.
 *
 * The dashboard auto-detects this whenever the operator has picked all
 * three of client + service + employee + durationOption in the booking
 * wizard — if a non-empty list comes back, we suggest "احجز من الرصيد".
 */
export async function fetchMatchingCredits(
  query: MatchingCreditsQuery,
): Promise<MatchingCredit[]> {
  return api.get<MatchingCredit[]>(
    "/dashboard/bookings/matching-credits",
    {
      clientId: query.clientId,
      serviceId: query.serviceId,
      employeeId: query.employeeId,
      durationOptionId: query.durationOptionId,
    },
  )
}

/**
 * Consume a session-package credit to create a zero-value booking.
 * Either pass `creditId` explicitly OR pass the full triple
 * (serviceId, employeeId, durationOptionId) so the backend FIFO-selects
 * the oldest matching credit.
 *
 * Returns the freshly-created booking row.
 */
export async function bookFromCredit(
  payload: BookFromCreditPayload,
): Promise<unknown> {
  return api.post<unknown>(
    "/dashboard/bookings/from-credit",
    payload,
  )
}