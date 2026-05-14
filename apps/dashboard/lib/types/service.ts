/**
 * Service Types — Deqah Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface ServiceCategory {
  id: string
  nameEn: string | null
  nameAr: string
  sortOrder: number
  isActive: boolean
  departmentId: string | null
  department?: { id: string; nameEn: string | null; nameAr: string } | null
  createdAt: string
  _count?: { services: number }
}

export interface CategoryListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
  departmentId?: string
}

export type RecurringPattern = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'

export interface Service {
  id: string
  nameEn: string | null
  nameAr: string
  descriptionEn: string | null
  descriptionAr: string | null
  categoryId: string | null
  price: number
  currency: string
  durationMins: number
  isActive: boolean
  isHidden: boolean
  hidePriceOnBooking: boolean
  hideDurationOnBooking: boolean
  iconName: string | null
  iconBgColor: string | null
  imageUrl: string | null
  bufferMinutes: number
  minLeadMinutes: number | null
  maxAdvanceDays: number | null
  depositEnabled: boolean
  depositAmount: number | null
  allowRecurring: boolean
  allowedRecurringPatterns: RecurringPattern[]
  maxRecurrences: number | null
  minParticipants: number
  maxParticipants: number
  reserveWithoutPayment: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  category?: ServiceCategory | null
  durationOptions?: ServiceDurationOption[]
}

// DB-10: bookingType is now the ServiceBookingMode enum ('IN_PERSON' | 'ONLINE').
export type ServiceBookingMode = 'IN_PERSON' | 'ONLINE'

export interface ServiceBookingType {
  id: string
  serviceId: string
  bookingType: ServiceBookingMode
  price: number
  durationMins: number
  isActive: boolean
  durationOptions: ServiceDurationOption[]
}

export interface ServiceDurationOption {
  id: string
  serviceId: string
  label: string
  labelAr: string | null
  durationMins: number
  price: number
  currency: string
  isDefault: boolean
  sortOrder: number
}

export interface IntakeForm {
  id: string
  nameAr: string
  nameEn: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  fields: IntakeField[]
}

export interface IntakeField {
  id: string
  formId: string
  labelAr: string
  labelEn: string | null
  fieldType: string
  options: string[] | null
  isRequired: boolean
  position: number
}

/* ─── Query ─── */

export interface ServiceListQuery extends PaginatedQuery {
  categoryId?: string
  isActive?: boolean
  includeHidden?: boolean
  search?: string
}

/* ─── Service Employees ─── */

export interface ServiceEmployeeServiceType {
  id: string
  bookingType: string
  price: number | null
  durationMins: number | null
  isActive: boolean
}

export interface ServiceEmployee {
  id: string // EmployeeService.id
  employee: {
    id: string
    nameAr: string | null
    title: string | null
    avatarUrl: string | null
    isActive: boolean
    user: {
      firstName: string
      lastName: string
    }
  }
  serviceTypes: ServiceEmployeeServiceType[]
  customDuration: number | null
  bufferMinutes: number
  availableTypes: string[]
  isActive: boolean
}
