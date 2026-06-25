/**
 * Package Credit Operations API — Sawaa Dashboard
 *
 * App-local thin client for the Phase 5 session-packages operator
 * mutations:
 *   POST /dashboard/bookings/credits/:creditId/transfer
 *   POST /dashboard/finance/package-purchases/:purchaseId/refund
 *
 * Mirrors the conventions of `lib/api/credit-bookings.ts` and
 * `lib/api/package-purchases.ts` — uses the shared `api` instance so
 * cookie-bearing refresh + envelope-unwrap are inherited for free.
 * Both endpoints expect integer halalas for any money payload; the
 * refund modal converts SAR → halalas at the form layer (see
 * `sarToHalalas` in lib/money) before calling this client.
 */

import { api } from "@/lib/api"
import type {
  RefundPackagePurchasePayload,
  RefundPackagePurchaseResult,
  TransferCreditPayload,
  TransferCreditResult,
} from "@/lib/types/credit-ops"

/**
 * Move a `PackageCredit` bucket to a different practitioner (the
 * "practitioner left" operational tool). The backend re-validates
 * that the target offers the SAME service+duration option, so a
 * mismatch returns 400. URL: `/dashboard/bookings/credits/:creditId/transfer`.
 */
export async function transferCredit(
  creditId: string,
  payload: TransferCreditPayload,
): Promise<TransferCreditResult> {
  return api.post<TransferCreditResult>(
    `/dashboard/bookings/credits/${creditId}/transfer`,
    payload,
  )
}

/**
 * Manually refund a session-package purchase. Marks the purchase
 * REFUNDED, voids the credits, and records the financial refund via
 * the existing finance RefundRequest table + event. A `refundAmount`
 * of 0 records a no-money cancellation. URL:
 * `/dashboard/finance/package-purchases/:purchaseId/refund`.
 */
export async function refundPackagePurchase(
  purchaseId: string,
  payload: RefundPackagePurchasePayload,
): Promise<RefundPackagePurchaseResult> {
  return api.post<RefundPackagePurchaseResult>(
    `/dashboard/finance/package-purchases/${purchaseId}/refund`,
    payload,
  )
}
