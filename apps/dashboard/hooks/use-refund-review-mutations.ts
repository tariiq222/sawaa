"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { manualRefundPayment } from "@/lib/api/payments"
import { approveRefundRequest, denyRefundRequest } from "@/lib/api/refund-review"
import { invalidateMutationImpact } from "@/lib/query-invalidation"
import type { Payment } from "@/lib/types/payment"

type ReviewAction = { refundRequestId: string } & (
  | { action: "settle"; reason: string; amount: number }
  | { action: "approve" }
  | { action: "deny"; reason: string }
)

export function useRefundReviewMutation(payment: Payment) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async (input: ReviewAction) => {
      if (input.action === "approve") return approveRefundRequest(input.refundRequestId)
      if (input.action === "deny") return denyRefundRequest(input.refundRequestId, input.reason)
      await manualRefundPayment(payment.id, {
        refundRequestId: input.refundRequestId, reason: input.reason, amount: input.amount,
      })
      // The exact-request manual endpoint commits settlement before returning.
      return { id: input.refundRequestId, status: "COMPLETED" }
    },
    onSuccess: () => invalidateMutationImpact(queryClient, {
      kind: "payment-refunded", paymentId: payment.id, invoiceId: payment.invoiceId,
      bookingId: payment.invoice?.bookingId, clientId: payment.invoice?.clientId,
    }),
  })
}
