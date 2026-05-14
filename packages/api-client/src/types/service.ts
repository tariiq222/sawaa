import type { PaginatedResponse, PaginationParams } from './api'

export interface ServiceCategory {
  id: string
  nameAr: string
  nameEn: string
}

export interface ServiceListItem {
  id: string
  nameAr: string
  nameEn: string
  descriptionAr: string | null
  descriptionEn: string | null
  categoryId: string
  category?: ServiceCategory
  price: number
  duration: number
  isActive: boolean
  isHidden: boolean
  iconName: string | null
  iconBgColor: string | null
  imageUrl: string | null
  createdAt: string
}

export interface ServiceStats {
  total: number
  active: number
  inactive: number
}

export interface ServiceListQuery extends PaginationParams {
  categoryId?: string
  isActive?: boolean
  includeHidden?: boolean
  branchId?: string
}

export interface CreateServicePayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  categoryId: string
  price?: number
  duration?: number
  isActive?: boolean
  isHidden?: boolean
  iconName?: string | null
  iconBgColor?: string | null
}

export interface UpdateServicePayload {
  nameAr?: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  categoryId?: string
  price?: number
  duration?: number
  isActive?: boolean
  isHidden?: boolean
  iconName?: string | null
  iconBgColor?: string | null
}

export type ServiceListResponse = PaginatedResponse<ServiceListItem>
