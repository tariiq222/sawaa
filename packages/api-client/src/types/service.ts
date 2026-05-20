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

// ─── Service Booking Config ──────────────────────────────────────────────────

export interface ServiceBookingConfig {
  id: string
  serviceId: string
  /** Delivery channel (IN_PERSON or ONLINE) */
  deliveryType: 'IN_PERSON' | 'ONLINE'
  price: number
  durationMins: number
  isActive: boolean
}

// ─── Service Duration Options ────────────────────────────────────────────────

export interface ServiceDurationOption {
  id: string
  serviceId: string
  /** Delivery channel (IN_PERSON or ONLINE) */
  deliveryType: 'IN_PERSON' | 'ONLINE'
  label: string
  labelAr: string | null
  durationMins: number
  price: number
  isDefault: boolean
  sortOrder: number
  isActive: boolean
}

// ─── Employee Service Options ────────────────────────────────────────────────

export interface EmployeeServiceOption {
  id: string
  employeeServiceId: string
  durationOptionId: string
  priceOverride: number | null
  durationOverride: number | null
  /** Delivery channel (IN_PERSON or ONLINE) */
  deliveryType: 'IN_PERSON' | 'ONLINE'
  isActive: boolean
}

export type ServiceListResponse = PaginatedResponse<ServiceListItem>
