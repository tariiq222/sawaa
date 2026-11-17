/**
 * Payments API — Sawaa Dashboard
 *
 * Every call goes through the typed helper in `lib/api/openapi.ts`, so a
 * renamed route or a changed payload is a type error here. Response types come
 * from the committed OpenAPI snapshot through `lib/types/payment.ts`.
 * Request URLs, query names/order and bodies are unchanged.
 *
 * Note on `fetchPayment`: the handler returns the payment detail envelope and
 * the dashboard has always typed the resolution as `Payment | null`. The route
 * answers 404 instead of null; the `| null` is retained on the return type only
 * (no fallback is added or removed).
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type {
  CollectBookingPaymentResult,
  CollectBookingPaymentPayload,
  Payment,
  PaymentListPage,
  PaymentListQuery,
  PaymentStats,
} from "@/lib/types/payment"
import type { EnsuredBookingInvoice } from "@/lib/types/invoice"

const PAYMENTS_PATH = "/dashboard/finance/payments"

export async function fetchPaymentStats(): Promise<PaymentStats> {
  return openApi.get("/api/v1/dashboard/finance/payments/stats")
}

export async function refundPayment(
  id: string,
  payload: { reason: string; amount?: number },
): Promise<Payment> {
  return openApi.patch("/api/v1/dashboard/finance/payments/{id}/refund", {
    path: { id },
    body: payload,
  })
}

export async function verifyPayment(
  id: string,
  payload: { action: 'approve' | 'reject'; transferRef?: string },
): Promise<Payment> {
  return openApi.patch("/api/v1/dashboard/finance/payments/{id}/verify", {
    path: { id },
    body: payload,
  })
}

/**
 * Manually refund a cash/bank-transfer payment (off-gateway). Reception-allowed.
 * amount in integer halalas; omit for a full refund. Reason required.
 * `idempotencyKey` makes a retried attempt return the original completion
 * instead of paying the client a second time (PAY-05); reuse it for retries of
 * the same logical payout.
 */
export async function manualRefundPayment(
  id: string,
  payload: { reason: string; amount?: number; refundRequestId?: string; idempotencyKey?: string },
): Promise<Payment> {
  return openApi.patch("/api/v1/dashboard/finance/payments/{id}/manual-refund", {
    path: { id },
    body: payload,
  })
}

export async function fetchPayments(
  query: PaymentListQuery = {},
): Promise<PaymentListPage> {
  // Transport stays on the plain client with the params object: the legacy call
  // dropped undefined/"" values but kept their order, and `buildQuery` is the
  // same helper the typed path uses. Keeping this call makes the request
  // byte-identical (verified input-by-input for this function).
  return api.get<PaymentListPage>(PAYMENTS_PATH, {
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

/**
 * Record a manual payment against an invoice. amount in integer halalas.
 *
 * The handler returns the persisted payment row; its INFERRED type (and so the
 * documented `PaymentProcessResponseDto`) is the `ProcessPaymentRecord` subset
 * the handler declares. The wire object is the full Prisma row — the dashboard
 * has always typed it as `Payment` and feeds it straight to
 * `invalidatePaymentResult`. The cast documents that known gap; it adds no
 * runtime behaviour.
 */
export async function recordPayment(payload: {
  invoiceId: string
  amount: number
  method: "CASH" | "BANK_TRANSFER" | "MADA" | "TABBY"
}): Promise<Payment> {
  return openApi.post("/api/v1/dashboard/finance/payments", {
    body: payload,
  }) as Promise<Payment>
}

/**
 * Ensure a booking has an invoice (creates a DRAFT one on demand for
 * pay-at-clinic bookings) and return it. Idempotent.
 */
export async function ensureBookingInvoice(bookingId: string): Promise<EnsuredBookingInvoice> {
  // Transport stays on the plain client: the typed helper has no request body
  // for this route, while the existing call sends an explicit `{}` and the
  // request must stay byte-identical.
  return api.post<EnsuredBookingInvoice>(
    `/dashboard/finance/bookings/${bookingId}/invoice`,
    {},
  )
}

/** Apply or clear a manual discount on an unpaid invoice. discountAmt in integer halalas (0 clears). */
export async function applyInvoiceDiscount(
  invoiceId: string,
  payload: { discountAmt: number; discountReasonId?: string; note?: string },
): Promise<unknown> {
  return openApi.patch("/api/v1/dashboard/finance/invoices/{id}/discount", {
    path: { id: invoiceId },
    body: payload,
  })
}

/** Re-exported so callers keep importing the payload type from this module. */
export type { CollectBookingPaymentPayload }

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
  // Transport stays on the plain client with a literal path: this is the
  // canonical reception collection call, and the literal `api.post(path, body)`
  // form keeps the request bytes (and the drift check's literal detection)
  // exactly as before.
  return api.post<CollectBookingPaymentResult>(
    `/dashboard/finance/bookings/${bookingId}/collect`,
    payload,
  )
}
