import { apiRequest } from '../client'
import { guestApiRequest } from './guest-client'
import { buildQueryString } from '../types/api'
import type {
  BookingListItem,
  BookingListQuery,
  BookingListResponse,
  BookingStats,
  CreateBookingPayload,
  UpdateBookingPayload,
} from '../types/booking'
import type { GuestBookingPayload, GuestBookingResponse } from '@deqah/shared'

export async function list(query: BookingListQuery = {}): Promise<BookingListResponse> {
  return apiRequest<BookingListResponse>(
    `/bookings${buildQueryString(query as Record<string, unknown>)}`,
  )
}

export async function stats(): Promise<BookingStats> {
  return apiRequest<BookingStats>('/bookings/stats')
}

export async function get(id: string): Promise<BookingListItem> {
  return apiRequest<BookingListItem>(`/bookings/${id}`)
}

export async function create(payload: CreateBookingPayload): Promise<BookingListItem> {
  return apiRequest<BookingListItem>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function update(
  id: string,
  payload: UpdateBookingPayload,
): Promise<BookingListItem> {
  return apiRequest<BookingListItem>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function createGuestBooking(
  payload: GuestBookingPayload,
): Promise<GuestBookingResponse> {
  return guestApiRequest<GuestBookingResponse>('/public/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
