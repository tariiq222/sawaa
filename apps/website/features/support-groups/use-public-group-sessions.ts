'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getPublicGroupSessions,
  type SupportGroup,
} from './support-groups.api';

export function usePublicGroupSessions(branchId?: string) {
  const { data: sessions = [], isLoading, error } = useQuery<SupportGroup[], Error>({
    queryKey: ['public', 'group-sessions', branchId],
    queryFn: () => getPublicGroupSessions(branchId),
  });

  return {
    sessions,
    isLoading,
    error: error?.message ?? null,
  };
}
