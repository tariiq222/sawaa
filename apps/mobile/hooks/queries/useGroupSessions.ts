import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  programsService,
  type EnrollInProgramResponse,
  type Program,
} from '@/services/client/group-sessions';

export const programKeys = {
  all: ['programs'] as const,
  lists: () => [...programKeys.all, 'list'] as const,
  detail: (id: string) => [...programKeys.all, 'detail', id] as const,
};

/** @deprecated use programKeys */
export const groupSessionKeys = programKeys;

export function useGroupSessions() {
  return useQuery<Program[]>({
    queryKey: programKeys.lists(),
    queryFn: () => programsService.list(),
  });
}

export function useGroupSession(id: string | undefined) {
  return useQuery<Program>({
    queryKey: programKeys.detail(id ?? ''),
    queryFn: () => programsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useBookGroupSession() {
  const queryClient = useQueryClient();
  return useMutation<EnrollInProgramResponse, Error, string>({
    mutationFn: (id) => programsService.enroll(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: programKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: programKeys.detail(id) });
    },
  });
}

/** @deprecated use useBookGroupSession (still references programsService.enroll). */
export const useEnrollInProgram = useBookGroupSession;
