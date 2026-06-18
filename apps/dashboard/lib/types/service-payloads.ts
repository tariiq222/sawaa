/**
 * Service Payload Types (DTOs) — Sawaa Dashboard
 */

/* ─── Category DTOs ─── */

export interface CreateCategoryPayload {
  nameAr: string
  nameEn?: string
  sortOrder?: number
  departmentId?: string | null
  bookingMode?: "DIRECT" | "SERVICES"
}

export interface UpdateCategoryPayload {
  nameEn?: string
  nameAr?: string
  sortOrder?: number
  isActive?: boolean
  departmentId?: string | null
  bookingMode?: "DIRECT" | "SERVICES"
}

/* ─── Service DTOs ─── */

import type { RecurringPattern } from './service'

export interface CreateServicePayload {
  nameAr: string
  nameEn: string
  descriptionAr?: string
  descriptionEn?: string
  categoryId: string
  durationMins: number
  price: number
  currency?: string
  imageUrl?: string | null
  isActive?: boolean
  isHidden?: boolean
  hidePriceOnBooking?: boolean
  hideDurationOnBooking?: boolean
  iconName?: string | null
  iconBgColor?: string | null
  bufferMinutes?: number
  minLeadMinutes?: number | null
  maxAdvanceDays?: number | null
  depositEnabled?: boolean
  depositAmount?: number
  allowRecurring?: boolean
  allowedRecurringPatterns?: RecurringPattern[]
  maxRecurrences?: number | null
  minParticipants?: number
  maxParticipants?: number
  reserveWithoutPayment?: boolean
}

export interface UpdateServicePayload {
  nameAr?: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  categoryId?: string
  durationMins?: number
  price?: number
  currency?: string
  imageUrl?: string | null
  isActive?: boolean
  isHidden?: boolean
  hidePriceOnBooking?: boolean
  hideDurationOnBooking?: boolean
  iconName?: string | null
  iconBgColor?: string | null
  bufferMinutes?: number
  minLeadMinutes?: number | null
  maxAdvanceDays?: number | null
  depositEnabled?: boolean
  depositAmount?: number
  allowRecurring?: boolean
  allowedRecurringPatterns?: RecurringPattern[]
  maxRecurrences?: number | null
  minParticipants?: number
  maxParticipants?: number
  reserveWithoutPayment?: boolean
}

/* ─── Duration Options Payloads ─── */

export interface DurationOptionPayload {
  id?: string
  label: string
  labelAr?: string
  durationMins: number
  price: number
  currency?: string
  isDefault?: boolean
  sortOrder?: number
}

export interface SetDurationOptionsPayload {
  options: DurationOptionPayload[]
}

/* ─── Delivery Type Payloads ─── */

// DB-10: deliveryType is now the ServiceDeliveryType enum.
import type { ServiceDeliveryType } from './service'

export interface DeliveryTypeConfigPayload {
  deliveryType: ServiceDeliveryType
  price: number
  durationMins: number
  isActive?: boolean
  durationOptions?: DurationOptionPayload[]
  useCustomAvailability?: boolean
  availabilityWindows?: ServiceAvailabilityWindowPayload[]
}

export interface ServiceAvailabilityWindowPayload {
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive?: boolean
}

// @deprecated Use DeliveryTypeConfigPayload.
export type BookingTypeConfigPayload = DeliveryTypeConfigPayload

export interface SetServiceBookingTypesPayload {
  types: DeliveryTypeConfigPayload[]
}

/* ─── Intake Forms Payloads ─── */

export interface CreateIntakeFormPayload {
  nameAr: string
  nameEn?: string
  isActive?: boolean
}
