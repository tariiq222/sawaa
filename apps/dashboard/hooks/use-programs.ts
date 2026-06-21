'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelProgram,
  createProgram,
  enrollClientInProgram,
  fetchProgram,
  fetchPrograms,
  publishProgram,
  scheduleProgram,
} from '@/lib/api/programs';
import type {
  CancelProgramPayload,
  CreateProgramPayload,
  EnrollInProgramPayload,
  ListProgramsQuery,
  ProgramDetail,
  ProgramSummary,
  ScheduleProgramPayload,
} from '@/lib/types/program';
import { queryKeys } from '@/lib/query-keys';

const STALE_TIME_MS = 30_000;

export function usePrograms(query: ListProgramsQuery = {}) {
  return useQuery<ProgramSummary[]>({
    queryKey: queryKeys.programs.list(query),
    queryFn: () => fetchPrograms(query),
    staleTime: STALE_TIME_MS,
  });
}

export function useProgram(idOrRef: string | undefined | null) {
  return useQuery<ProgramDetail>({
    queryKey: queryKeys.programs.detail(idOrRef ?? ''),
    queryFn: () => fetchProgram(idOrRef as string),
    enabled: Boolean(idOrRef),
    staleTime: STALE_TIME_MS,
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProgramPayload) => createProgram(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.programs.lists() });
    },
  });
}

export function usePublishProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => publishProgram(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
    },
  });
}

export function useScheduleProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ScheduleProgramPayload }) =>
      scheduleProgram(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
    },
  });
}

export function useCancelProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CancelProgramPayload }) =>
      cancelProgram(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.programs.detail(id) });
    },
  });
}

export function useEnrollClientInProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnrollInProgramPayload) => enrollClientInProgram(payload),
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: queryKeys.programs.lists() });
      qc.invalidateQueries({ queryKey: queryKeys.programs.detail(payload.programId) });
    },
  });
}
