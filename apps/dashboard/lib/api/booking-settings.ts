/**
 * Booking Settings API — Deqah Dashboard
 */

import { api } from "@/lib/api"

export type RecurringPattern =
  | "daily"
  | "every_2_days"
  | "every_3_days"
  | "weekly"
  | "biweekly"
  | "monthly"

export const RECURRING_PATTERNS: { value: RecurringPattern; labelKey: string }[] = [
  { value: "daily", labelKey: "settings.recurringPattern.daily" },
  { value: "every_2_days", labelKey: "settings.recurringPattern.every_2_days" },
  { value: "every_3_days", labelKey: "settings.recurringPattern.every_3_days" },
  { value: "weekly", labelKey: "settings.recurringPattern.weekly" },
  { value: "biweekly", labelKey: "settings.recurringPattern.biweekly" },
  { value: "monthly", labelKey: "settings.recurringPattern.monthly" },
]

export type RefundType = "FULL" | "PARTIAL" | "NONE"

export interface BookingSettings {
  id?: string
  organizationId?: string
  branchId?: string | null
  bufferMinutes: number
  freeCancelBeforeHours: number
  freeCancelRefundType: RefundType
  lateCancelRefundPercent: number
  maxReschedulesPerBooking: number
  autoCompleteAfterHours: number
  autoNoShowAfterMinutes: number
  minBookingLeadMinutes: number
  maxAdvanceBookingDays: number
  waitlistEnabled: boolean
  waitlistMaxPerSlot: number
  payAtClinicEnabled: boolean
  requireCancelApproval: boolean
  autoRefundOnCancel: boolean
  clientRescheduleMinHoursBefore: number
  createdAt?: string
  updatedAt?: string
}

export async function fetchBookingSettings(): Promise<BookingSettings> {
  return api.get<BookingSettings>("/dashboard/organization/booking-settings")
}

export async function updateBookingSettings(
  data: Record<string, unknown>,
): Promise<BookingSettings> {
  return api.patch<BookingSettings>(
    "/dashboard/organization/booking-settings",
    data,
  )
}
