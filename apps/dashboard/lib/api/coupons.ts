/**
 * Coupons API — Sawaa Dashboard
 *
 * Response/payload types are derived from the committed OpenAPI snapshot
 * (`lib/types/coupon.ts`). The list call keeps the plain `api.get(path, params)`
 * transport so the request bytes are unchanged; the parameter-less calls use
 * the typed helper (`openApi`), which builds the same URL.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type {
  Coupon,
  CouponListPage,
  CouponListQuery,
  CreateCouponPayload,
  UpdateCouponPayload,
} from "@/lib/types/coupon"

/* ─── List ─── */

export async function fetchCoupons(
  query: CouponListQuery = {},
): Promise<CouponListPage> {
  return api.get<CouponListPage>("/dashboard/finance/coupons", {
    page: query.page,
    limit: query.limit,
    search: query.search,
    status: query.status,
  })
}

/* ─── Detail ─── */

export async function fetchCoupon(id: string): Promise<Coupon> {
  return openApi.get("/api/v1/dashboard/finance/coupons/{id}", { path: { id } })
}

/* ─── Create ─── */

export async function createCoupon(payload: CreateCouponPayload): Promise<Coupon> {
  return openApi.post("/api/v1/dashboard/finance/coupons", { body: payload })
}

/* ─── Update ─── */

export async function updateCoupon(
  id: string,
  payload: UpdateCouponPayload,
): Promise<Coupon> {
  return openApi.patch("/api/v1/dashboard/finance/coupons/{id}", {
    path: { id },
    body: payload,
  })
}

/* ─── Delete ─── */

export async function deleteCoupon(id: string): Promise<void> {
  await openApi.delete("/api/v1/dashboard/finance/coupons/{id}", { path: { id } })
}
