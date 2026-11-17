/**
 * Credit Bookings API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 3 session-packages consumption
 * endpoints (POST /dashboard/bookings/from-credit,
 * GET /dashboard/bookings/matching-credits). These routes belong to the
 * bookings controller; their wire shapes are documented there and derived
 * here from the committed OpenAPI snapshot.
 *
 * Calls go through the typed helper in `lib/api/openapi.ts`; query names,
 * order and the returned objects are unchanged.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
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
  // Transport stays on the plain client: the legacy call dropped `deliveryType`
  // when absent and kept the other three in order, and `buildQuery` is the same
  // helper the typed path uses. Keeping this call makes the request
  // byte-identical (verified input-by-input for this function).
  return api.get<MatchingCredit[]>(
    "/dashboard/bookings/matching-credits",
    {
      clientId: query.clientId,
      serviceId: query.serviceId,
      employeeId: query.employeeId,
      durationOptionId: query.durationOptionId,
      ...(query.deliveryType ? { deliveryType: query.deliveryType } : {}),
    },
  )
}

/**
 * Consume a session-package credit to create a zero-value booking.
 * Either pass `creditId` explicitly OR pass the full triple
 * (serviceId, employeeId, durationOptionId) so the backend FIFO-selects
 * the oldest matching credit.
 *
 * Returns the freshly-created booking row; the dashboard only reads a few
 * identity fields through `readBookingContext`, so the result stays `unknown`
 * exactly as before.
 */
export async function bookFromCredit(
  payload: BookFromCreditPayload,
): Promise<unknown> {
  return openApi.post("/api/v1/dashboard/bookings/from-credit", { body: payload })
}
