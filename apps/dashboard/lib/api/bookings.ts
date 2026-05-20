/**
 * Bookings API — Sawaa Dashboard
 * Controller: dashboard/bookings
 */

import { api } from "@/lib/api"
import { combineDateTimeToISO } from "@/lib/utils"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Booking,
  BookingListQuery,
  CreateBookingPayload,
  ReschedulePayload,
  AdminCancelPayload,
  CreateRecurringPayload,
} from "@/lib/types/booking"

/**
 * Backend bookings DTOs accept ISO `scheduledAt` (create) and
 * `newScheduledAt` (reschedule). The dashboard UI carries `date` + `startTime`
 * (wall-clock Asia/Riyadh). Adapt at the API boundary so feature components
 * keep their natural shape and only one place owns the contract translation.
 */
function adaptCreatePayload(p: CreateBookingPayload) {
  const { date, startTime, type, ...rest } = p
  const scheduledAt = combineDateTimeToISO(date, startTime)
  if (!scheduledAt) {
    throw new Error("Invalid booking date/time")
  }
  return { ...rest, scheduledAt, bookingType: type ? String(type).toUpperCase() : undefined }
}

function adaptReschedulePayload(p: ReschedulePayload) {
  if (!p.date || !p.startTime) {
    throw new Error("Reschedule requires date and startTime")
  }
  const newScheduledAt = combineDateTimeToISO(p.date, p.startTime)
  if (!newScheduledAt) {
    throw new Error("Invalid reschedule date/time")
  }
  return { newScheduledAt }
}

export async function fetchBookings(
  query: BookingListQuery = {},
): Promise<PaginatedResponse<Booking>> {
  return api.get<PaginatedResponse<Booking>>("/dashboard/bookings", {
    page: query.page,
    limit: query.perPage,
    status: query.status,
    bookingType: query.type,
    employeeId: query.employeeId,
    clientId: query.clientId,
    fromDate: query.dateFrom,
    toDate: query.dateTo,
    search: query.search,
    isGuest: query.isGuest,
  })
}

export async function fetchBooking(id: string): Promise<Booking> {
  return api.get<Booking>(`/dashboard/bookings/${id}`)
}

export interface BookingsStats {
  todayCount: number
  pendingCount: number
  completedToday: number
  revenueToday: number
}

export async function fetchBookingsStats(): Promise<BookingsStats> {
  return api.get<BookingsStats>("/dashboard/bookings/stats")
}

export interface BookingStatusLogEntry {
  id: string
  fromStatus: string | null
  toStatus: string
  createdAt: string
  reason: string | null
}

export async function fetchBookingStatusLog(id: string): Promise<BookingStatusLogEntry[]> {
  return api.get<BookingStatusLogEntry[]>(`/dashboard/bookings/${id}/status-log`)
}

export async function createBooking(
  payload: CreateBookingPayload,
): Promise<Booking> {
  return api.post<Booking>("/dashboard/bookings", adaptCreatePayload(payload))
}

export async function createRecurringBooking(
  payload: CreateRecurringPayload,
): Promise<Booking[]> {
  return api.post<Booking[]>("/dashboard/bookings/recurring", payload)
}

export async function rescheduleBooking(
  id: string,
  payload: ReschedulePayload,
): Promise<Booking> {
  return api.patch<Booking>(
    `/dashboard/bookings/${id}/reschedule`,
    adaptReschedulePayload(payload),
  )
}

export async function confirmBooking(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/confirm`)
}

export async function completeBooking(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/complete`)
}

export async function markNoShow(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/no-show`)
}

export async function checkInBooking(id: string): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/check-in`)
}

export async function adminCancelBooking(
  id: string,
  payload: AdminCancelPayload,
): Promise<Booking> {
  return api.patch<Booking>(`/dashboard/bookings/${id}/cancel`, payload)
}

