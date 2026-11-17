/**
 * Package Purchases API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 2 endpoints:
 *   POST /dashboard/finance/package-purchases
 *   GET  /dashboard/finance/clients/:clientId/package-purchases
 *
 * Response/payload types are derived from the committed OpenAPI snapshot
 * (`lib/types/package-purchase.ts`). The list call keeps the plain
 * `api.get(path, params)` transport so the request bytes are unchanged; the
 * create call uses the typed helper (`openApi`) with the same JSON body.
 *
 * `CreatePackagePurchaseResult` is a documented DEFERRAL: the handler returns an
 * untyped union, so that response shape is not in the snapshot yet.
 */

import { api } from "@/lib/api"
import type {
  ClientPackagePurchasesQuery,
  CreatePackagePurchasePayload,
  CreatePackagePurchaseResult,
  PackagePurchase,
} from "@/lib/types/package-purchase"

/**
 * Sell a SessionPackage to a client at the desk. The backend freezes the
 * price server-side, issues the full-amount invoice, records the manual
 * payment, and returns the resulting purchase + credits.
 */
export async function createPackagePurchase(
  payload: CreatePackagePurchasePayload,
): Promise<CreatePackagePurchaseResult> {
  // Transport stays on the plain client: the response of this route is not yet
  // in the snapshot (deferred), so the typed helper would resolve `void`.
  return api.post<CreatePackagePurchaseResult>(
    "/dashboard/finance/package-purchases",
    payload,
  )
}

/**
 * List every package purchase a given client has made (newest paid
 * first), with each purchase's credits enriched with resolved
 * service / employee / duration display names.
 */
export async function fetchClientPackagePurchases(
  clientId: string,
  query: ClientPackagePurchasesQuery = {},
): Promise<PackagePurchase[]> {
  return api.get<PackagePurchase[]>(
    `/dashboard/finance/clients/${clientId}/package-purchases`,
    {
      status: query.status,
    },
  )
}
