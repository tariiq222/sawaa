import type { AvailableSlot, GuestBookingPayload, GuestBookingResponse } from '@sawaa/shared';
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

export interface AvailabilityDay {
  date: string;
  hasSlots: boolean;
}

export async function getPublicAvailabilityDays(
  employeeId: string,
  opts: { serviceId?: string; branchId?: string; startDate?: string; days?: number } = {},
): Promise<AvailabilityDay[]> {
  const params = new URLSearchParams();
  if (opts.serviceId) params.set('serviceId', opts.serviceId);
  if (opts.branchId) params.set('branchId', opts.branchId);
  if (opts.startDate) params.set('startDate', opts.startDate);
  if (opts.days) params.set('days', String(opts.days));
  const qs = params.toString();
  const json = await publicFetch<unknown>(
    `/public/employees/${employeeId}/availability/days${qs ? `?${qs}` : ''}`,
    { cache: 'no-store' },
  );
  return unwrap<AvailabilityDay[]>(json);
}

export async function getPublicAvailability(
  employeeId: string,
  date: string,
  serviceId?: string,
  branchId?: string,
): Promise<AvailableSlot[]> {
  const params = new URLSearchParams({ date });
  if (serviceId) params.set('serviceId', serviceId);
  if (branchId) params.set('branchId', branchId);
  const json = await publicFetch<unknown>(
    `/public/employees/${employeeId}/availability?${params}`,
    { cache: 'no-store' },
  );
  return unwrap<AvailableSlot[]>(json);
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
