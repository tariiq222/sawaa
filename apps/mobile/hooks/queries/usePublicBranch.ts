import { useQuery } from '@tanstack/react-query';
import { publicBranchesService } from '@/services/client/branches';
import { publicBranchKeys } from './usePublicBranches';

export function usePublicBranch(id: string | undefined) {
  return useQuery({
    queryKey: [...publicBranchKeys.all, 'detail', id] as const,
    queryFn: () => publicBranchesService.getById(id as string),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(id),
  });
}
