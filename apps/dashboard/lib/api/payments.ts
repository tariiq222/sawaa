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

/**
 * Manually refund a cash/bank-transfer payment (off-gateway). Reception-allowed.
 * amount in integer halalas; omit for a full refund. Reason required.
 */
export async function manualRefundPayment(
  id: string,
  payload: { reason: string; amount?: number },
): Promise<Payment> {
  return api.patch<Payment>(`/dashboard/finance/payments/${id}/manual-refund`, payload)
}

export async function fetchPayments(
  query: PaymentListQuery = {},
): Promise<PaginatedResponse<Payment>> {
  return api.get<PaginatedResponse<Payment>>("/dashboard/finance/payments", {
    page: query.page,
    limit: query.limit,
    search: query.search,
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

/** Invoice shape returned when ensuring a booking has a (DRAFT) invoice. All amounts in halalas. */
export interface EnsuredBookingInvoice {
  id: string
  subtotal: number
  vatRate: number
  total: number
  outstanding: number
  status: string
}

/**
 * Ensure a booking has an invoice (creates a DRAFT one on demand for
 * pay-at-clinic bookings) and return it. Idempotent.
 */
export async function ensureBookingInvoice(bookingId: string): Promise<EnsuredBookingInvoice> {
  return api.post<EnsuredBookingInvoice>(`/dashboard/finance/bookings/${bookingId}/invoice`, {})
}

/** Apply or clear a manual discount on an unpaid invoice. discountAmt in integer halalas (0 clears). */
export async function applyInvoiceDiscount(
  invoiceId: string,
  payload: { discountAmt: number; discountReasonId?: string; note?: string },
): Promise<unknown> {
  return api.patch(`/dashboard/finance/invoices/${invoiceId}/discount`, payload)
}

/**
 * Body for the unified booking collection endpoint. Staff methods are
 * statistical labels only — the backend never calls Moyasar here.
 */
export interface CollectBookingPaymentPayload {
  method: "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"
  /** Integer halalas. Omit to let the server default to the invoice's full outstanding. */
  amount?: number
  /** Optional discount applied on top of the payment (integer halalas). */
  discountAmt?: number
  /** Required when discountAmt > 0 (server enforces). */
  discountReasonId?: string
  /** Free-text note attached to the payment or the discount. */
  note?: string
  /** Client-supplied idempotency key — same key returns the same result. */
  idempotencyKey?: string
}

/**
 * Response for the unified booking collection endpoint. `payment` is null when
 * the call only adjusted the discount (no money moved).
 */
export interface CollectBookingPaymentResult {
  bookingId: string
  invoice: EnsuredBookingInvoice
  payment: { id: string; amount: number; method: string; status: string } | null
}

/**
 * Unified booking collection — single round trip that ensures the booking has
 * an invoice, applies any discount, and records the payment. amount/discountAmt
 * are in integer halalas. Staff methods (CASH/BANK_TRANSFER/MADA/TABBY) are
 * statistical labels; the server does not call Moyasar.
 */
export async function collectBookingPayment(
  bookingId: string,
  payload: CollectBookingPaymentPayload,
): Promise<CollectBookingPaymentResult> {
  return api.post<CollectBookingPaymentResult>(
    `/dashboard/finance/bookings/${bookingId}/collect`,
    payload,
  )
}
