import { useQuery } from '@tanstack/react-query';
import { publicBranchesService } from '@/services/client/branches';

export const publicBranchKeys = {
  all: ['public-branches'] as const,
  list: () => [...publicBranchKeys.all, 'list'] as const,
};

export function usePublicBranches(enabled = true) {
  return useQuery({
    meta: { silentError: true },
    queryKey: publicBranchKeys.list(),
    queryFn: () => publicBranchesService.list(),
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
