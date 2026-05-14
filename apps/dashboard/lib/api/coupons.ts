/**
 * Coupons API — Deqah Dashboard
 *
 * Dashboard types mirror the backend (PERCENTAGE/FIXED + minOrderAmt),
 * so this module is a thin pass-through to the network layer.
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Coupon,
  CouponListQuery,
  CreateCouponPayload,
  UpdateCouponPayload,
} from "@/lib/types/coupon"

/* ─── List ─── */

export async function fetchCoupons(
  query: CouponListQuery = {},
): Promise<PaginatedResponse<Coupon>> {
  return api.get<PaginatedResponse<Coupon>>("/dashboard/finance/coupons", {
    page: query.page,
    limit: query.perPage,
    search: query.search,
    status: query.status,
  })
}

/* ─── Detail ─── */

export async function fetchCoupon(id: string): Promise<Coupon> {
  return api.get<Coupon>(`/dashboard/finance/coupons/${id}`)
}

/* ─── Create ─── */

export async function createCoupon(payload: CreateCouponPayload): Promise<Coupon> {
  return api.post<Coupon>("/dashboard/finance/coupons", payload)
}

/* ─── Update ─── */

export async function updateCoupon(
  id: string,
  payload: UpdateCouponPayload,
): Promise<Coupon> {
  return api.patch<Coupon>(`/dashboard/finance/coupons/${id}`, payload)
}

/* ─── Delete ─── */

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/dashboard/finance/coupons/${id}`)
}
