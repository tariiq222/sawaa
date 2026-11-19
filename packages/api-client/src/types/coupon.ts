import type { components, paths } from './generated/openapi'
import type { PaginatedResponse, PaginationParams } from './api'

type Schemas = components['schemas']
type CouponRow = Schemas['CouponRecordDto']

/**
 * Coupon discount type. The snapshot's `CouponRecordDto.discountType` is
 * UPPER_CASE (`PERCENTAGE | FIXED`); this legacy vocabulary is lower-case.
 */
export type CouponDiscountType = Lowercase<CouponRow['discountType']>

/** `status` filter of `GET /api/v1/dashboard/finance/coupons` (inline enum). */
export type CouponStatusFilter = NonNullable<
  NonNullable<
    paths['/api/v1/dashboard/finance/coupons']['get']['parameters']['query']
  >['status']
>

/**
 * Row of `GET /dashboard/finance/coupons` (`CouponRecordDto`), projected to the
 * legacy shape. Transformed fields (documented → legacy):
 *  - `discountType` UPPER_CASE → lower-case (`CouponDiscountType`)
 *  - `discountValue` decimal string → number
 *  - `minOrderAmt` decimal string → `minAmount` number
 */
export type CouponListItem = Pick<
  CouponRow,
  | 'id'
  | 'code'
  | 'descriptionAr'
  | 'descriptionEn'
  | 'maxUses'
  | 'usedCount'
  | 'maxUsesPerUser'
  | 'serviceIds'
  | 'expiresAt'
  | 'isActive'
  | 'createdAt'
  | 'updatedAt'
> & {
  discountType: CouponDiscountType
  discountValue: number
  /** Renamed/narrowed from the documented decimal-string `minOrderAmt`. */
  minAmount: number
}

/** Query of the list operation: paging + the documented `status` filter. */
export type CouponListQuery = PaginationParams & Pick<
  NonNullable<paths['/api/v1/dashboard/finance/coupons']['get']['parameters']['query']>,
  'status'
>

/**
 * NOT derived: `POST /dashboard/finance/coupons` documents `CreateCouponDto`
 * with `minOrderAmt` (not `minAmount`) and UPPER_CASE `discountType`. This
 * legacy payload differs in both, so it stays hand-written.
 */
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

/** Legacy exported DTO (no current coupon endpoint consumer); preserve its names. */
export type UpdateCouponPayload = Omit<
  Partial<CreateCouponPayload>,
  'minAmount' | 'maxUses' | 'maxUsesPerUser' | 'expiresAt'
> & {
  minAmount?: number | null
  maxUses?: number | null
  maxUsesPerUser?: number | null
  expiresAt?: string | null
}

export type CouponListResponse = PaginatedResponse<CouponListItem>

/** NOT derived: no documented coupons-stats operation. Kept hand-written. */
export interface CouponStats {
  total: number
  active: number
  expired: number
  totalUses: number
}
