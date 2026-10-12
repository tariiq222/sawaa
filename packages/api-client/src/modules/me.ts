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
  return apiRequest<ClientProfile>('/client/profile', { credentials: 'include' });
}

/**
 * PATCH /client/profile body. `email` may only be set when the account has no
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
  return apiRequest<UpdatedMyProfile>('/client/profile', {
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
    `/client/invoices?page=${page}&pageSize=${pageSize}`,
    { credentials: 'include' },
  );
}

export async function getMyBookings(
  page = 1,
  pageSize = 10,
  tab?: 'upcoming' | 'past' | 'cancelled',
): Promise<ClientBookingListResponse> {
  return apiRequest<ClientBookingListResponse>(
    `/client/bookings?page=${page}&pageSize=${pageSize}${tab ? `&tab=${tab}` : ''}`,
    { credentials: 'include' },
  );
}

export async function getMyCancellationPreview(bookingId: string): Promise<CancellationPreview> {
  return apiRequest<CancellationPreview>(`/client/bookings/${encodeURIComponent(bookingId)}/cancellation-preview`, { credentials: 'include' });
}

export async function cancelMyBooking(
  bookingId: string,
  payload: CancelMyBookingPayload & CancellationQuoteInput,
): Promise<ClientCancellationResult> {
  return apiRequest<ClientCancellationResult>(
    `/client/bookings/${bookingId}/cancel`,
    {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(payload ?? {}),
    },
  );
}

/** DELETE /client/profile — closes the signed-in client's account. */
export async function closeMyAccount(): Promise<void> {
  await apiRequest<unknown>('/client/profile', { method: 'DELETE', credentials: 'include' });
}

export interface RateMyBookingPayload {
  score: number;
  comment?: string;
  isPublic?: boolean;
}

/** POST /client/bookings/:id/rate */
export async function rateMyBooking(
  bookingId: string,
  payload: RateMyBookingPayload,
): Promise<unknown> {
  return apiRequest<unknown>(`/client/bookings/${encodeURIComponent(bookingId)}/rate`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(payload),
  });
}

/** GET /client/bookings/:id/join — lazily resolves the online session link. */
export async function getMyBookingJoinLink(bookingId: string): Promise<unknown> {
  return apiRequest<unknown>(`/client/bookings/${encodeURIComponent(bookingId)}/join`, {
    credentials: 'include',
  });
}

export async function rescheduleMyBooking(
  bookingId: string,
  payload: RescheduleMyBookingPayload,
): Promise<{ booking: unknown }> {
  return apiRequest<{ booking: unknown }>(
    `/client/bookings/${bookingId}/reschedule`,
    {
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify(payload),
    },
  );
}
