/**
 * Refund Review API — Sawaa Dashboard
 *
 * Approve/deny a pending refund request. Response types are derived from the
 * committed OpenAPI snapshot; both calls go through the typed helper in
 * `lib/api/openapi.ts` with the same URLs and bodies as before.
 */

import { openApi } from "@/lib/api/openapi"
import type { components } from "@/lib/types/api.generated"

type Schemas = components["schemas"]

/** The `{ id, status }` projection both review actions return. */
export type RefundReviewResult = Schemas["RefundApprovalResponseDto"]

export function approveRefundRequest(refundRequestId: string): Promise<RefundReviewResult> {
  return openApi.post("/api/v1/dashboard/refunds/approve", {
    body: { refundRequestId },
  })
}

export function denyRefundRequest(refundRequestId: string, reason: string): Promise<RefundReviewResult> {
  // The deny route returns the persisted RefundRequest row, which starts with
  // the same `{ id, status }` projection the caller reads.
  return openApi.post("/api/v1/dashboard/refunds/deny", {
    body: { refundRequestId, reason },
  }) as Promise<RefundReviewResult>
}
