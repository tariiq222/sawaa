import api from '../api';

/**
 * Public Program shape from /api/v1/public/programs.
 *
 * The historical name `GroupSession` is kept as an alias to minimise
 * churn on screens that imported the old service; new code should prefer
 * `Program`. The fields are now aligned with the unified backend model
 * (Program, not GroupSession).
 */
export interface Program {
  id: string;
  ref: number;
  title: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr: string | null;
  descriptionEn: string | null;
  publicDescriptionAr: string | null;
  publicDescriptionEn: string | null;
  departmentId: string;
  branchId: string;
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
  isFull: boolean;
  spotsLeft: number;
  /** Back-compat aliases for the old GroupSession field names. */
  scheduledAt?: string;
  durationMins?: number;
  maxCapacity?: number;
}

/** @deprecated use Program */
export type GroupSession = Program;

export interface EnrollInProgramResponse {
  type: 'ENROLLED';
  bookingId?: string;
}

/** @deprecated use EnrollInProgramResponse */
export type BookGroupSessionResponse = EnrollInProgramResponse;

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'programs' in (body as Record<string, unknown>)) {
    return (body as { programs: T }).programs;
  }
  if (body && typeof body === 'object' && 'data' in (body as Record<string, unknown>)) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function mapProgram(p: Record<string, unknown>): Program {
  const enrolled = Number(p.enrolledCount ?? 0);
  const max = Number(p.maxParticipants ?? 0);
  const startDate = (p.startDate as string | null) ?? null;
  const daysCount = Number(p.daysCount ?? 0);
  const hoursPerDay = Number(p.hoursPerDay ?? 0);
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
    scheduledAt: startDate ?? '',
    durationMins: hoursPerDay * 60,
    maxCapacity: max,
  };
}

export const programsService = {
  async list(departmentId?: string): Promise<Program[]> {
    const response = await api.get<unknown>('/public/programs', {
      params: departmentId ? { departmentId } : undefined,
    });
    const body = unwrap<unknown>(response.data);
    const list = Array.isArray(body) ? body : [];
    return list.map((p) => mapProgram(p as Record<string, unknown>));
  },

  async get(id: string): Promise<Program> {
    const response = await api.get<unknown>(`/public/programs/${encodeURIComponent(id)}`);
    return mapProgram(unwrap<Record<string, unknown>>(response.data));
  },

  async enroll(id: string): Promise<EnrollInProgramResponse> {
    const response = await api.post<unknown>(`/public/programs/${encodeURIComponent(id)}/enroll`);
    return unwrap<EnrollInProgramResponse>(response.data);
  },
};

/** @deprecated use programsService */
export const groupSessionsService = programsService;
