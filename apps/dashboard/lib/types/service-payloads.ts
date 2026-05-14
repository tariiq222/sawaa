/**
 * Service Payload Types (DTOs) — Deqah Dashboard
 */

/* ─── Category DTOs ─── */

export interface CreateCategoryPayload {
  nameAr: string
  nameEn?: string
  sortOrder?: number
  departmentId?: string | null
}

export interface UpdateCategoryPayload {
  nameEn?: string
  nameAr?: string
  sortOrder?: number
  isActive?: boolean
  departmentId?: string | null
}

/* ─── Service DTOs ─── */

import type { RecurringPattern } from './service'

export interface CreateServicePayload {
  nameAr: string
  nameEn?: string
  descriptionAr?: string
  descriptionEn?: string
  categoryId?: string
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

/* ─── Booking Type Payloads ─── */

// DB-10: bookingType is now the ServiceBookingMode enum.
import type { ServiceBookingMode } from './service'

export interface BookingTypeConfigPayload {
  bookingType: ServiceBookingMode
  price: number
  durationMins: number
  isActive?: boolean
  durationOptions?: DurationOptionPayload[]
}

export interface SetServiceBookingTypesPayload {
  types: BookingTypeConfigPayload[]
}

/* ─── Intake Forms Payloads ─── */

export interface CreateIntakeFormPayload {
  nameAr: string
  nameEn?: string
  isActive?: boolean
}
