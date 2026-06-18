/**
 * Booking Settings API — Sawaa Dashboard
 */

import { api } from "@/lib/api"

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
