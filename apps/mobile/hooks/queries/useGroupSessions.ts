import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  groupSessionsService,
  type BookGroupSessionResponse,
  type GroupSession,
} from '@/services/client/group-sessions';

export const groupSessionKeys = {
  all: ['group-sessions'] as const,
  lists: () => [...groupSessionKeys.all, 'list'] as const,
  detail: (id: string) => [...groupSessionKeys.all, 'detail', id] as const,
};

export function useGroupSessions() {
  return useQuery<GroupSession[]>({
    queryKey: groupSessionKeys.lists(),
    queryFn: () => groupSessionsService.list(),
  });
}

export function useGroupSession(id: string | undefined) {
  return useQuery<GroupSession>({
    queryKey: groupSessionKeys.detail(id ?? ''),
    queryFn: () => groupSessionsService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useBookGroupSession() {
  const queryClient = useQueryClient();
  return useMutation<BookGroupSessionResponse, Error, string>({
    mutationFn: (id) => groupSessionsService.book(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: groupSessionKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: groupSessionKeys.detail(id) });
    },
  });
}
