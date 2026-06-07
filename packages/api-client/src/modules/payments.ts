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
    limit: query.perPage,
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
