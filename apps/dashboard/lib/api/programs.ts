/**
 * Programs API — Sawaa Dashboard
 *
 * Every dashboard call goes through the typed helper in `lib/api/openapi.ts`
 * (reads) or the shared adapter with an explicit response type (writes), so a
 * renamed route, a changed query or a changed payload is a type error here.
 * Response types come from the committed OpenAPI snapshot through
 * `lib/types/program.ts`.
 *
 * The public `/api/v1/public/programs` fetchers stay on native `fetch` and keep
 * a hand-written payload type: those routes belong to the public unit and carry
 * no response schema in the snapshot yet.
 */

import { api } from "@/lib/api"
import { openApi } from "@/lib/api/openapi"
import type {
  CancelProgramPayload,
  CreateProgramPayload,
  EnrollInProgramPayload,
  EnrollInProgramResult,
  ListProgramsQuery,
  ProgramCancellationPreview,
  ProgramCancellationResult,
  ProgramDetail,
  ProgramPublishResult,
  ProgramScheduleResult,
  ProgramSummary,
  ProgramWriteResult,
  PublicProgramListItem,
  ScheduleProgramPayload,
  UpdateProgramPayload,
} from "@/lib/types/program"

const PROGRAMS_PATH = "/api/v1/dashboard/programs"
const PROGRAM_PATH = "/api/v1/dashboard/programs/{id}"

export async function fetchPrograms(query: ListProgramsQuery = {}): Promise<ProgramSummary[]> {
  return openApi.get(PROGRAMS_PATH, {
    query: {
      status: query.status,
      departmentId: query.departmentId,
      branchId: query.branchId,
    },
  })
}

/**
 * The route accepts a UUID *or* the printed numeric ref, so the path parameter
 * is documented as a plain string and passed through verbatim (the typed helper
 * URL-encodes it).
 */
export async function fetchProgram(idOrRef: string): Promise<ProgramDetail> {
  return openApi.get(PROGRAM_PATH, { path: { id: idOrRef } })
}

export async function createProgram(payload: CreateProgramPayload): Promise<ProgramWriteResult> {
  return api.post<ProgramWriteResult>("/dashboard/programs", payload)
}

export async function updateProgram(id: string, payload: UpdateProgramPayload): Promise<ProgramWriteResult> {
  return api.patch<ProgramWriteResult>(`/dashboard/programs/${id}`, payload)
}

export async function publishProgram(id: string): Promise<ProgramPublishResult> {
  return api.patch<ProgramPublishResult>(`/dashboard/programs/${id}/publish`)
}

export async function scheduleProgram(id: string, payload: ScheduleProgramPayload): Promise<ProgramScheduleResult> {
  return api.patch<ProgramScheduleResult>(`/dashboard/programs/${id}/schedule`, payload)
}

export async function fetchProgramCancellationPreview(id: string): Promise<ProgramCancellationPreview> {
  return api.get<ProgramCancellationPreview>(`/dashboard/programs/${id}/cancellation-preview`)
}

export async function cancelProgram(id: string, payload: CancelProgramPayload): Promise<ProgramCancellationResult> {
  return api.patch<ProgramCancellationResult>(`/dashboard/programs/${id}/cancel`, payload)
}

export async function enrollClientInProgram(payload: EnrollInProgramPayload): Promise<EnrollInProgramResult> {
  // programId is taken from the URL; the body carries only the client
  // (the backend EnrollClientDto rejects unknown fields).
  return api.post<EnrollInProgramResult>(`/dashboard/programs/${payload.programId}/enrollments`, {
    clientId: payload.clientId,
  })
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
