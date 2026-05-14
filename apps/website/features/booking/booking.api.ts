import type { AvailableSlot, GuestBookingPayload, GuestBookingResponse } from '@deqah/shared';
import type { PublicEmployee } from '@deqah/api-client';
import { publicFetch } from '@/lib/public-fetch';

export interface PublicBranch {
  id: string;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  addressAr: string | null;
}

/** Backend public endpoints sometimes return `{ data: T }`, sometimes `T` directly. */
function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function getPublicBranches(): Promise<PublicBranch[]> {
  const json = await publicFetch<unknown>('/public/branches', { cache: 'no-store' });
  return unwrap<PublicBranch[]>(json);
}

export async function getPublicAvailability(
  employeeId: string,
  date: string,
  serviceId?: string,
): Promise<AvailableSlot[]> {
  const params = new URLSearchParams({ date });
  if (serviceId) params.set('serviceId', serviceId);
  const json = await publicFetch<unknown>(
    `/public/employees/${employeeId}/availability?${params}`,
    { cache: 'no-store' },
  );
  return unwrap<AvailableSlot[]>(json);
}

export async function listPublicEmployees(): Promise<PublicEmployee[]> {
  const json = await publicFetch<unknown>('/public/employees', {
    next: { revalidate: 60, tags: ['public-employees'] },
  });
  return unwrap<PublicEmployee[]>(json);
}

export async function createGuestBooking(
  payload: GuestBookingPayload,
  sessionToken: string,
): Promise<GuestBookingResponse> {
  const json = await publicFetch<unknown>('/public/bookings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify(payload),
  });
  return unwrap<GuestBookingResponse>(json);
}

export async function initGuestPayment(
  bookingId: string,
  sessionToken: string,
): Promise<{ paymentId: string; redirectUrl: string }> {
  const json = await publicFetch<unknown>('/public/payments/init', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ bookingId }),
  });
  return unwrap<{ paymentId: string; redirectUrl: string }>(json);
}
