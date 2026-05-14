/**
 * Bookings API — Deqah Dashboard
 * Controller: dashboard/bookings
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type {
  Booking,
  BookingListQuery,
  CreateBookingPayload,
  ReschedulePayload,
  AdminCancelPayload,
  CreateRecurringPayload,
} from "@/lib/types/booking"

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
  return api.post<Booking>("/dashboard/bookings", payload)
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
  return api.patch<Booking>(`/dashboard/bookings/${id}/reschedule`, payload)
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

export async function addToWaitlist(payload: unknown): Promise<unknown> {
  return api.post<unknown>("/dashboard/bookings/waitlist", payload)
}
