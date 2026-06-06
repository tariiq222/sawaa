import type {
  ClientProfile,
  ClientBookingListResponse,
  CancelMyBookingPayload,
  RescheduleMyBookingPayload,
} from '@sawaa/shared';
import { apiRequest, setApiRequestBaseUrl } from '../client';

export function setMeBaseUrl(url: string): void {
  setApiRequestBaseUrl(url);
}

export async function getMe(): Promise<ClientProfile> {
  return apiRequest<ClientProfile>('/public/me', { credentials: 'include' });
}

export async function getMyBookings(
  page = 1,
  pageSize = 10,
): Promise<ClientBookingListResponse> {
  return apiRequest<ClientBookingListResponse>(
    `/public/me/bookings?page=${page}&pageSize=${pageSize}`,
    { credentials: 'include' },
  );
}

export async function cancelMyBooking(
  bookingId: string,
  payload?: CancelMyBookingPayload,
): Promise<{ status: string; booking: unknown; requiresApproval: boolean }> {
  return apiRequest<{ status: string; booking: unknown; requiresApproval: boolean }>(
    `/public/me/bookings/${bookingId}/cancel`,
    {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function rescheduleMyBooking(
  bookingId: string,
  payload: RescheduleMyBookingPayload,
): Promise<{ booking: unknown }> {
  return apiRequest<{ booking: unknown }>(
    `/public/me/bookings/${bookingId}/reschedule`,
    {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(payload),
    },
  );
}
