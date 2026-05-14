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

  const res = await fetch(url, {
    next: { revalidate: 60, tags: ['public-group-sessions'] },
  });
  if (!res.ok) throw new Error(`Failed to fetch group sessions: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as SupportGroup[];
}

export async function getPublicGroupSession(
  groupSessionId: string,
): Promise<SupportGroup> {
  const res = await fetch(
    `${getApiBase()}/public/bookings/group-sessions/${encodeURIComponent(groupSessionId)}`,
    {
      next: { revalidate: 60, tags: ['public-group-sessions', `group-session-${groupSessionId}`] },
    },
  );
  if (!res.ok) throw new Error(`Failed to fetch group session: ${res.status}`);
  const json = await res.json();
  return (json.data ?? json) as SupportGroup;
}

export async function bookGroupSession(
  groupSessionId: string,
  accessToken: string,
): Promise<BookGroupSessionResponse> {
  const res = await fetch(
    `${getApiBase()}/public/bookings/group-sessions/${encodeURIComponent(groupSessionId)}/book`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
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
