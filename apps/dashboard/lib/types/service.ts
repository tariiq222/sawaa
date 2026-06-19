/**
 * Service Types — Sawaa Dashboard
 */

import type { PaginatedQuery } from "./common"

/* ─── Entities ─── */

export interface ServiceCategory {
  id: string
  ref: number
  nameEn: string | null
  nameAr: string
  sortOrder: number
  isActive: boolean
  departmentId: string | null
  bookingMode?: "DIRECT" | "SERVICES"
  department?: { id: string; nameEn: string | null; nameAr: string } | null
  iconName?: string | null
  iconBgColor?: string | null
  imageUrl?: string | null
  createdAt: string
  _count?: { services: number }
}

export interface CategoryListQuery extends PaginatedQuery {
  search?: string
  isActive?: boolean
  departmentId?: string
}

export interface Service {
  id: string
  ref: number
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
  minParticipants: number
  maxParticipants: number
  reserveWithoutPayment: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  category?: ServiceCategory | null
  durationOptions?: ServiceDurationOption[]
  /** Active employees offering this service. 0 ⇒ wizard disables the service. */
  employeeCount?: number
}

// DB-10: deliveryType is now the ServiceDeliveryType enum ('IN_PERSON' | 'ONLINE').
export type ServiceDeliveryType = 'IN_PERSON' | 'ONLINE'

export interface ServiceBookingType {
  id: string
  serviceId: string
  deliveryType: ServiceDeliveryType
  price: number
  durationMins: number
  isActive: boolean
  useCustomAvailability: boolean
  durationOptions: ServiceDurationOption[]
  availabilityWindows: ServiceAvailabilityWindow[]
}

export interface ServiceAvailabilityWindow {
  id: string
  serviceId: string
  deliveryType: ServiceDeliveryType
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
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
  ref: number
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
  deliveryType: string
  price: number | null
  durationMins: number | null
  isActive: boolean
  basePrice: number         // halalas — service's base price for this type
  baseDurationMins: number  // base duration from service
  isCustom: boolean         // true when this employee has a price override
}

export interface PractitionerDurationItem {
  id: string
  deliveryType: 'IN_PERSON' | 'ONLINE'
  label: string
  labelAr: string
  durationMins: number
  price: number  // integer halalas
  isInherited: boolean
}

export interface PractitionerDurationGroup {
  deliveryType: 'IN_PERSON' | 'ONLINE'
  durations: PractitionerDurationItem[]
}

export interface ServiceEmployee {
  id: string // EmployeeService.id
  employee: {
    id: string
    nameAr: string | null
    title: string | null
    avatarUrl: string | null
    isActive: boolean
    branchIds?: string[]
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
  hasCustomPricing: boolean
  effectiveDurations?: PractitionerDurationGroup[]
}
