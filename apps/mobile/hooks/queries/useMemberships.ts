import { useQuery } from '@tanstack/react-query';

import type { MembershipSummary } from '@/services/memberships';

export const membershipsKeys = {
  all: ['memberships'] as const,
};

export function useMemberships() {
  return useQuery<MembershipSummary[]>({
    queryKey: membershipsKeys.all,
    queryFn: async () => [],
    staleTime: 60_000,
    enabled: false,
  });
}
