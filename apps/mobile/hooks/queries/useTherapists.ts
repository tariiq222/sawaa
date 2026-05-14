import { useQuery } from '@tanstack/react-query';

import {
  publicEmployeesService,
  type PublicEmployeeItem,
} from '@/services/client';

export const therapistKeys = {
  all: ['therapists'] as const,
  lists: () => [...therapistKeys.all, 'list'] as const,
  details: () => [...therapistKeys.all, 'detail'] as const,
  detail: (key: string) => [...therapistKeys.details(), key] as const,
  slots: (params: Record<string, unknown>) =>
    [...therapistKeys.all, 'slots', params] as const,
};

export function useTherapists() {
  return useQuery<PublicEmployeeItem[]>({
    queryKey: therapistKeys.lists(),
    queryFn: () => publicEmployeesService.list(),
  });
}
