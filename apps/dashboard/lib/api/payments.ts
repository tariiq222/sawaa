/**
 * Payments API — Sawaa Dashboard
 * Controller: dashboard/finance/payments
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Payment, PaymentListQuery, PaymentStats } from "@/lib/types/payment"

export async function fetchPaymentStats(): Promise<PaymentStats> {
  return api.get<PaymentStats>("/dashboard/finance/payments/stats")
}

export async function refundPayment(
  id: string,
  payload: { reason: string; amount?: number },
): Promise<Payment> {
  return api.patch<Payment>(`/dashboard/finance/payments/${id}/refund`, payload)
}

export async function verifyPayment(
  id: string,
  payload: { action: 'approve' | 'reject'; transferRef?: string },
): Promise<Payment> {
  return api.patch<Payment>(`/dashboard/finance/payments/${id}/verify`, payload)
}

export async function fetchPayments(
  query: PaymentListQuery = {},
): Promise<PaginatedResponse<Payment>> {
  return api.get<PaginatedResponse<Payment>>("/dashboard/finance/payments", {
    page: query.page,
    limit: query.perPage,
    status: query.status,
    method: query.method,
    fromDate: query.dateFrom,
    toDate: query.dateTo,
  })
}

export async function fetchPayment(id: string): Promise<Payment | null> {
  return api.get<Payment>(`/dashboard/finance/payments/${id}`)
}

/** Record a manual payment against an invoice. amount in integer halalas. */
export async function recordPayment(payload: {
  invoiceId: string
  amount: number
  method: "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"
}): Promise<Payment> {
  return api.post<Payment>("/dashboard/finance/payments", payload)
}

/** Apply or clear a manual discount on an unpaid invoice. discountAmt in integer halalas (0 clears). */
export async function applyInvoiceDiscount(
  invoiceId: string,
  payload: { discountAmt: number; discountReasonId?: string; note?: string },
): Promise<unknown> {
  return api.patch(`/dashboard/finance/invoices/${invoiceId}/discount`, payload)
}
