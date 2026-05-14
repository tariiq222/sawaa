import type { PaginatedResponse, PaginationParams } from './api'

export type CouponDiscountType = 'percentage' | 'fixed'

export type CouponStatusFilter = 'active' | 'inactive' | 'expired'

export interface CouponListItem {
  id: string
  code: string
  descriptionAr: string | null
  descriptionEn: string | null
  discountType: CouponDiscountType
  discountValue: number
  minAmount: number
  maxUses: number | null
  usedCount: number
  maxUsesPerUser: number | null
  serviceIds: string[]
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CouponListQuery extends PaginationParams {
  status?: CouponStatusFilter
}

export interface CreateCouponPayload {
  code: string
  descriptionAr?: string
  descriptionEn?: string
  discountType: CouponDiscountType
  discountValue: number
  minAmount?: number
  maxUses?: number
  maxUsesPerUser?: number
  serviceIds?: string[]
  expiresAt?: string
  isActive?: boolean
}

export type UpdateCouponPayload = Partial<CreateCouponPayload>

export type CouponListResponse = PaginatedResponse<CouponListItem>

export interface CouponStats {
  total: number
  active: number
  expired: number
  totalUses: number
}
