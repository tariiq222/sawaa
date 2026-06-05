import * as Sentry from '@sentry/nextjs';

import { getApiBase } from '@/lib/api-base';

export interface SupportGroup {
  id: string;
  title: string;
  descriptionAr: string | null;
  descriptionEn: string | null;
  scheduledAt: string;
  durationMins: number;
  maxCapacity: number;
  enrolledCount: number;
  price: number;
  currency: string;
  status: string;
  waitlistEnabled: boolean;
  waitlistCount: number;
  employeeId: string;
  serviceId: string;
  spotsLeft: number;
  isFull: boolean;
  isWaitlistOnly: boolean;
}

export interface BookGroupSessionResponse {
  type: 'BOOKED' | 'WAITLISTED';
  bookingId?: string;
  waitlistPosition?: number;
}

export async function getPublicGroupSessions(
  branchId?: string,
): Promise<SupportGroup[]> {
  const base = getApiBase();
  const url = branchId
    ? `${base}/public/bookings/group-sessions?branchId=${encodeURIComponent(branchId)}`
    : `${base}/public/bookings/group-sessions`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      Sentry.addBreadcrumb({
        category: 'fetch',
        level: 'warning',
        message: '[support-groups] fetch failed — using empty list',
        data: { status: res.status },
      });
      return [];
    }
    const json = await res.json();
    return (json.data ?? json) as SupportGroup[];
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'fetch',
      level: 'warning',
      message: '[support-groups] fetch error — using empty list',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return [];
  }
}

export async function getPublicGroupSession(
  groupSessionId: string,
): Promise<SupportGroup> {
  const res = await fetch(
    `${getApiBase()}/public/bookings/group-sessions/${encodeURIComponent(groupSessionId)}`,
    {
      next: { revalidate: 60 },
    },
  );
  if (!res.ok) throw new Error(`Failed to fetch group session: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as SupportGroup;
}

export async function bookGroupSession(
  groupSessionId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _accessToken?: string,
): Promise<BookGroupSessionResponse> {
  const res = await fetch(
    `${getApiBase()}/public/bookings/group-sessions/${encodeURIComponent(groupSessionId)}/book`,
    {
      method: 'POST',
      credentials: 'include',
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? 'Booking failed');
  }
  const json = await res.json();
  return (json.data ?? json) as BookGroupSessionResponse;
}
