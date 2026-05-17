/**
 * Bundle Types — Sawaa Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export type BundleDiscountType = 'PERCENTAGE' | 'FIXED'

export interface BundleItem {
  id: string
  serviceId: string
  sortOrder: number
  service: {
    id: string
    nameAr: string
    nameEn: string | null
    price: number
    currency: string
    durationMins: number
  }
}

export interface ServiceBundle {
  id: string
  nameAr: string
  nameEn: string | null
  descriptionAr: string | null
  descriptionEn: string | null
  imageUrl: string | null
  iconName: string | null
  iconBgColor: string | null
  discountType: BundleDiscountType
  discountValue: number
  currency: string
  isActive: boolean
  isHidden: boolean
  sortOrder: number
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  items: BundleItem[]
  subtotal: number
  discountAmount: number
  finalPrice: number
}

export interface BundleListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
  includeHidden?: boolean
}

export interface CreateBundlePayload {
  nameAr: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  discountType: BundleDiscountType
  discountValue: number
  currency?: string
  isActive?: boolean
  isHidden?: boolean
  sortOrder?: number
  serviceIds: string[]
}

export type UpdateBundlePayload = Partial<CreateBundlePayload>

export interface BundlePriceBreakdown {
  subtotal: number
  discountAmount: number
  finalPrice: number
}
