import type { CancellationPreview, CancellationQuoteInput, ClientCancellationResult } from '../types/cancellation';
import type {
  ClientProfile,
  ClientBookingListResponse,
  ClientInvoiceListResponse,
  CancelMyBookingPayload,
  RescheduleMyBookingPayload,
  UpdateClientProfilePayload,
} from '@sawaa/shared';
import { apiRequest, setApiRequestBaseUrl } from '../client';

export function setMeBaseUrl(url: string): void {
  setApiRequestBaseUrl(url);
}

export async function getMe(): Promise<ClientProfile> {
  return apiRequest<ClientProfile>('/public/me', { credentials: 'include' });
}

/**
 * PATCH /public/me body. `email` may only be set when the account has no
 * email yet — the backend rejects otherwise and returns 409 Conflict when
 * the email belongs to another account.
 */
export type UpdateMyProfileRequest = UpdateClientProfilePayload & {
  email?: string;
  preferredLocale?: 'ar' | 'en';
  pushEnabled?: boolean;
};

export type UpdatedMyProfile = ClientProfile & {
  preferredLocale: string | null;
  pushEnabled: boolean;
};

export async function updateMyProfile(
  payload: UpdateMyProfileRequest,
): Promise<UpdatedMyProfile> {
  return apiRequest<UpdatedMyProfile>('/public/me', {
    method: 'PATCH',
    credentials: 'include',
    body: JSON.stringify(payload),
  });
}

export async function getMyInvoices(
  page = 1,
  pageSize = 50,
): Promise<ClientInvoiceListResponse> {
  return apiRequest<ClientInvoiceListResponse>(
    `/public/me/invoices?page=${page}&pageSize=${pageSize}`,
    { credentials: 'include' },
  );
}

export async function getMyBookings(
  page = 1,
  pageSize = 10,
  tab?: 'upcoming' | 'past' | 'cancelled',
): Promise<ClientBookingListResponse> {
  return apiRequest<ClientBookingListResponse>(
    `/public/me/bookings?page=${page}&pageSize=${pageSize}${tab ? `&tab=${tab}` : ''}`,
    { credentials: 'include' },
  );
}

export async function getMyCancellationPreview(bookingId: string): Promise<CancellationPreview> {
  return apiRequest<CancellationPreview>(`/public/me/bookings/${encodeURIComponent(bookingId)}/cancellation-preview`, { credentials: 'include' });
}

export async function cancelMyBooking(
  bookingId: string,
  payload: CancelMyBookingPayload & CancellationQuoteInput,
): Promise<ClientCancellationResult> {
  return apiRequest<ClientCancellationResult>(
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
