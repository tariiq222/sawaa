import * as Sentry from '@sentry/nextjs';

import { getApiBase } from '@/lib/api-base';

/**
 * Public-facing Program shape (alias of the new /api/v1/public/programs
 * response). Kept under the historical "support-group" name for now to
 * minimise churn on the website pages — the model on the backend is the
 * unified Program.
 */
export interface SupportGroup {
  id: string;
  ref: number;
  /** Arabic display name (was `title` on the old GroupSession model). */
  title: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  /** Public-facing description override (was added in the program model). */
  publicDescriptionAr: string | null;
  publicDescriptionEn: string | null;
  departmentId: string;
  branchId: string;
  /** Multi-day program schedule. */
  startDate: string | null;
  daysCount: number;
  hoursPerDay: number;
  minParticipants: number;
  maxParticipants: number;
  enrolledCount: number;
  /** Price in integer halalas. */
  price: string;
  currency: string;
  depositEnabled: boolean;
  depositAmount: string | null;
  status: string;
  isPublic: boolean;
  /** Computed from enrolledCount >= maxParticipants. */
  isFull: boolean;
  spotsLeft: number;

  /**
   * Back-compat aliases for the old GroupSession shape. New code should
   * prefer `startDate` + `daysCount`/`hoursPerDay` over these.
   */
  scheduledAt?: string;
  durationMins?: number;
  maxCapacity?: number;
  serviceId?: string;
  employeeId?: string;
}

export interface BookGroupSessionResponse {
  type: 'ENROLLED';
  bookingId?: string;
  /** Booking lifecycle status — AWAITING_PAYMENT for paid programs, CONFIRMED for free ones. */
  status?: string;
  /** Invoice to pay for paid programs (price > 0); null/undefined for free programs. */
  invoiceId?: string | null;
}

export async function getPublicGroupSessions(
  departmentId?: string,
): Promise<SupportGroup[]> {
  const base = getApiBase();
  const url = departmentId
    ? `${base}/public/programs?departmentId=${encodeURIComponent(departmentId)}`
    : `${base}/public/programs`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      Sentry.addBreadcrumb({
        category: 'fetch',
        level: 'warning',
        message: '[programs] fetch failed — using empty list',
        data: { status: res.status },
      });
      return [];
    }
    const data = await res.json();
    const list = (data?.programs ?? data) as Array<Record<string, unknown>>;
    return list.map(mapProgramToSupportGroup);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'support-groups' } });
    return [];
  }
}

export async function getPublicGroupSession(id: string): Promise<SupportGroup | null> {
  const base = getApiBase();
  const url = `${base}/public/programs/${encodeURIComponent(id)}`;

  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return mapProgramToSupportGroup(data);
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'support-groups' } });
    return null;
  }
}

export async function bookGroupSession(id: string): Promise<BookGroupSessionResponse> {
  const base = getApiBase();
  const url = `${base}/public/programs/${id}/enroll`;
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to enroll in program: ${res.status} ${errText}`);
  }
  return (await res.json()) as BookGroupSessionResponse;
}

function mapProgramToSupportGroup(p: Record<string, unknown>): SupportGroup {
  const enrolled = Number(p.enrolledCount ?? 0);
  const max = Number(p.maxParticipants ?? 0);
  const startDate = (p.startDate as string | null) ?? null;
  const hoursPerDay = Number(p.hoursPerDay ?? 0);
  const daysCount = Number(p.daysCount ?? 0);
  return {
    id: String(p.id),
    ref: Number(p.ref ?? 0),
    title: String(p.nameAr ?? ''),
    nameAr: String(p.nameAr ?? ''),
    nameEn: (p.nameEn as string | null) ?? null,
    descriptionAr: (p.descriptionAr as string | null) ?? null,
    descriptionEn: (p.descriptionEn as string | null) ?? null,
    publicDescriptionAr: (p.publicDescriptionAr as string | null) ?? null,
    publicDescriptionEn: (p.publicDescriptionEn as string | null) ?? null,
    departmentId: String(p.departmentId ?? ''),
    branchId: String(p.branchId ?? ''),
    startDate,
    daysCount,
    hoursPerDay,
    minParticipants: Number(p.minParticipants ?? 0),
    maxParticipants: max,
    enrolledCount: enrolled,
    price: String(p.price ?? '0'),
    currency: String(p.currency ?? 'SAR'),
    depositEnabled: Boolean(p.depositEnabled),
    depositAmount: (p.depositAmount as string | null) ?? null,
    status: String(p.status ?? ''),
    isPublic: Boolean(p.isPublic),
    isFull: Boolean(p.isFull) || enrolled >= max,
    spotsLeft: Math.max(0, max - enrolled),
    // Back-compat aliases
    scheduledAt: startDate ?? '',
    durationMins: hoursPerDay * 60,
    maxCapacity: max,
    serviceId: '',
    employeeId: '',
  };
}
