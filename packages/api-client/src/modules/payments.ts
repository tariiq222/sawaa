import { apiRequest } from '../client'
import { guestApiRequest } from './guest-client'
import { buildQueryString } from '../types/api'
import type {
  PaymentListItem,
  PaymentListQuery,
  PaymentListResponse,
  PaymentStats,
} from '../types/payment'
import type { InitPaymentResponse } from '@deqah/shared'

export async function list(
  query: PaymentListQuery = {},
): Promise<PaymentListResponse> {
  return apiRequest<PaymentListResponse>(
    `/payments${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<PaymentStats> {
  return apiRequest<PaymentStats>('/payments/stats')
}

export async function get(id: string): Promise<PaymentListItem> {
  return apiRequest<PaymentListItem>(`/payments/${id}`)
}

export async function initGuestPayment(bookingId: string): Promise<InitPaymentResponse> {
  return guestApiRequest<InitPaymentResponse>('/public/payments/init', {
    method: 'POST',
    body: JSON.stringify({ bookingId }),
  });
}
