/**
 * Package Purchases API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 2 endpoints:
 *   POST /dashboard/finance/package-purchases
 *   GET  /dashboard/finance/clients/:clientId/package-purchases
 *
 * Mirrors the conventions of `lib/api/packages.ts` (Phase 1) — uses the
 * shared `api` instance so cookie-bearing refresh + envelope-unwrap are
 * inherited for free. The body for the create call matches the backend
 * DTO verbatim (`method`, not `paymentMethod`).
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
