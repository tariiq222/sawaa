import { api } from "@/lib/api"

export interface RefundReviewResult { id: string; status: string }

export function approveRefundRequest(refundRequestId: string): Promise<RefundReviewResult> {
  return api.post<RefundReviewResult>("/dashboard/refunds/approve", { refundRequestId })
}

export function denyRefundRequest(refundRequestId: string, reason: string): Promise<RefundReviewResult> {
  return api.post<RefundReviewResult>("/dashboard/refunds/deny", { refundRequestId, reason })
}
