import { apiRequest } from '../client'
import type {
  PaymentListItem,
  PaymentListQuery,
  PaymentListResponse,
  PaymentStats,
} from '../types/payment'

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function listPayments(
  query: PaymentListQuery = {},
): Promise<PaymentListResponse> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    search: query.search,
    status: query.status,
    method: query.method,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
  return apiRequest<PaymentListResponse>(`/dashboard/finance/payments${qs}`)
}

export async function getPayment(id: string): Promise<PaymentListItem> {
  return apiRequest<PaymentListItem>(`/dashboard/finance/payments/${id}`)
}

export async function getPaymentStats(): Promise<PaymentStats> {
  return apiRequest<PaymentStats>('/dashboard/finance/payments/stats')
}

export async function refundPayment(
  id: string,
  payload: { reason: string; amount?: number },
): Promise<PaymentListItem> {
  return apiRequest<PaymentListItem>(
    `/dashboard/finance/payments/${id}/refund`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export async function verifyPayment(
  id: string,
  payload: { action: 'approve' | 'reject'; transferRef?: string },
): Promise<PaymentListItem> {
  return apiRequest<PaymentListItem>(
    `/dashboard/finance/payments/${id}/verify`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

/** Record a manual payment (CASH / BANK_TRANSFER) against an invoice. Amount in integer halalas. */
export async function processPayment(payload: {
  invoiceId: string
  amount: number
  method: 'CASH' | 'BANK_TRANSFER' | 'COUPON'
  gatewayRef?: string
  idempotencyKey?: string
}): Promise<PaymentListItem> {
  return apiRequest<PaymentListItem>('/dashboard/finance/payments', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Client-facing refund request for a paid invoice. Authenticated via the
 * client-session httpOnly cookie (`credentials: 'include'`).
 */
export async function requestRefund(
  invoiceId: string,
  reason?: string,
): Promise<unknown> {
  return apiRequest('/public/refunds/request', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(reason ? { invoiceId, reason } : { invoiceId }),
  })
}

/** Apply or clear a manual discount on an unpaid invoice. discountAmt in integer halalas (0 clears it). */
export async function applyInvoiceDiscount(
  invoiceId: string,
  payload: { discountAmt: number; discountReasonId?: string; note?: string },
): Promise<unknown> {
  return apiRequest(`/dashboard/finance/invoices/${invoiceId}/discount`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}
