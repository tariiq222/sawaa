import type {
  ClientProfile,
  ClientBookingListResponse,
  CancelMyBookingPayload,
  RescheduleMyBookingPayload,
} from '@deqah/shared';

async function meFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Unauthorized');
    }
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as unknown;
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}

let baseUrl = '';
export function setMeBaseUrl(url: string): void {
  baseUrl = url;
}
function getBaseUrl(): string {
  return baseUrl;
}

export async function getMe(): Promise<ClientProfile> {
  return meFetch<ClientProfile>('/public/me');
}

export async function getMyBookings(
  page = 1,
  pageSize = 10,
): Promise<ClientBookingListResponse> {
  return meFetch<ClientBookingListResponse>(
    `/public/me/bookings?page=${page}&pageSize=${pageSize}`,
  );
}

export async function cancelMyBooking(
  bookingId: string,
  payload?: CancelMyBookingPayload,
): Promise<{ status: string; booking: unknown; requiresApproval: boolean }> {
  return meFetch<{ status: string; booking: unknown; requiresApproval: boolean }>(
    `/public/me/bookings/${bookingId}/cancel`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload ?? {}),
    },
  );
}

export async function rescheduleMyBooking(
  bookingId: string,
  payload: RescheduleMyBookingPayload,
): Promise<{ booking: unknown }> {
  return meFetch<{ booking: unknown }>(
    `/public/me/bookings/${bookingId}/reschedule`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}
