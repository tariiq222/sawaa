/**
 * Coupon Types — Deqah Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface Coupon {
  id: string
  code: string
  descriptionAr: string | null
  descriptionEn: string | null
  discountType: "PERCENTAGE" | "FIXED"
  discountValue: number
  minOrderAmt: number | null
  maxUses: number | null
  usedCount: number
  maxUsesPerUser: number | null
  serviceIds: string[]
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/* ─── Query ─── */

export interface CouponListQuery extends PaginatedQuery {
  search?: string
  status?: "active" | "inactive" | "expired"
}

/* ─── DTOs ─── */

export interface CreateCouponPayload {
  code: string
  descriptionAr?: string
  descriptionEn?: string
  discountType: "PERCENTAGE" | "FIXED"
  discountValue: number
  minOrderAmt?: number
  maxUses?: number
  maxUsesPerUser?: number
  serviceIds?: string[]
  expiresAt?: string
  isActive?: boolean
}

export interface UpdateCouponPayload {
  code?: string
  descriptionAr?: string
  descriptionEn?: string
  discountType?: "PERCENTAGE" | "FIXED"
  discountValue?: number
  minOrderAmt?: number
  maxUses?: number
  maxUsesPerUser?: number
  serviceIds?: string[]
  expiresAt?: string
  isActive?: boolean
}

export interface ApplyCouponPayload {
  code: string
  serviceId?: string
  amount: number
}

export interface ApplyCouponResult {
  discountAmount: number
  couponId: string
}
