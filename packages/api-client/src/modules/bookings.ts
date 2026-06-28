import { apiRequest } from '../client'
import type {
  BookingListItem,
  BookingListQuery,
  BookingListResponse,
  CreateBookingPayload,
} from '../types/booking'

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  })
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function listBookings(
  query: BookingListQuery = {},
): Promise<BookingListResponse> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    status: query.status,
    type: query.type,
    employeeId: query.employeeId,
    clientId: query.clientId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })
  return apiRequest<BookingListResponse>(`/dashboard/bookings${qs}`)
}

export async function getBooking(id: string): Promise<BookingListItem> {
  return apiRequest<BookingListItem>(`/dashboard/bookings/${id}`)
}

export async function createBooking(
  payload: CreateBookingPayload,
): Promise<BookingListItem> {
  return apiRequest<BookingListItem>('/dashboard/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function cancelBooking(
  id: string,
  payload: { reason?: string } = {},
): Promise<BookingListItem> {
  return apiRequest<BookingListItem>(`/dashboard/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function confirmBooking(id: string): Promise<BookingListItem> {
  return apiRequest<BookingListItem>(`/dashboard/bookings/${id}/confirm`, {
    method: 'PATCH',
  })
}

export async function completeBooking(id: string): Promise<BookingListItem> {
  return apiRequest<BookingListItem>(`/dashboard/bookings/${id}/complete`, {
    method: 'PATCH',
  })
}
