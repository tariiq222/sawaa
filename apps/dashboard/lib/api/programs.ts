import { api } from '@/lib/api';
import type {
  CancelProgramPayload,
  CreateProgramPayload,
  EnrollInProgramPayload,
  EnrollInProgramResult,
  ListProgramsQuery,
  ProgramDetail,
  ProgramSummary,
  PublicProgramListItem,
  ScheduleProgramPayload,
} from '@/lib/types/program';

export async function fetchPrograms(query: ListProgramsQuery = {}): Promise<ProgramSummary[]> {
  return api.get('/dashboard/programs', {
    status: query.status,
    departmentId: query.departmentId,
    branchId: query.branchId,
  });
}

export async function fetchProgram(idOrRef: string): Promise<ProgramDetail> {
  return api.get(`/dashboard/programs/${encodeURIComponent(idOrRef)}`);
}

export async function createProgram(payload: CreateProgramPayload) {
  return api.post('/dashboard/programs', payload);
}

export async function publishProgram(id: string) {
  return api.patch(`/dashboard/programs/${id}/publish`);
}

export async function scheduleProgram(id: string, payload: ScheduleProgramPayload) {
  return api.patch(`/dashboard/programs/${id}/schedule`, payload);
}

export async function cancelProgram(id: string, payload: CancelProgramPayload) {
  return api.patch(`/dashboard/programs/${id}/cancel`, payload);
}

export async function enrollClientInProgram(payload: EnrollInProgramPayload): Promise<EnrollInProgramResult> {
  // programId is taken from the URL; the body carries only the client
  // (the backend EnrollClientDto rejects unknown fields).
  return api.post(`/dashboard/programs/${payload.programId}/enrollments`, {
    clientId: payload.clientId,
  });
}

export async function fetchPublicPrograms(departmentId?: string): Promise<PublicProgramListItem[]> {
  const res = await fetch(
    `/api/v1/public/programs${departmentId ? `?departmentId=${departmentId}` : ''}`,
    { credentials: 'include' },
  );
  if (!res.ok) throw new Error(`Failed to load public programs: ${res.status}`);
  const data = await res.json();
  return (data?.programs ?? data) as PublicProgramListItem[];
}

export async function fetchPublicProgram(id: string): Promise<PublicProgramListItem> {
  const res = await fetch(`/api/v1/public/programs/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load public program: ${res.status}`);
  return res.json();
}
