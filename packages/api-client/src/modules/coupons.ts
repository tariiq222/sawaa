import { apiRequest } from '../client'
import { buildQueryString } from '../types/api'
import type {
  CouponListItem,
  CouponListQuery,
  CouponListResponse,
  CreateCouponPayload,
  UpdateCouponPayload,
} from '../types/coupon'

export async function list(
  query: CouponListQuery = {},
): Promise<CouponListResponse> {
  return apiRequest<CouponListResponse>(
    `/coupons${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function get(id: string): Promise<CouponListItem> {
  return apiRequest<CouponListItem>(`/coupons/${id}`)
}

export async function create(
  payload: CreateCouponPayload,
): Promise<CouponListItem> {
  return apiRequest<CouponListItem>('/coupons', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateCouponPayload,
): Promise<CouponListItem> {
  return apiRequest<CouponListItem>(`/coupons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function remove(id: string): Promise<{ deleted: true }> {
  return apiRequest<{ deleted: true }>(`/coupons/${id}`, { method: 'DELETE' })
}
