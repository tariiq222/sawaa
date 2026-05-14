import { useQuery } from '@tanstack/react-query';

import {
  publicEmployeesService,
  type PublicEmployeeItem,
} from '@/services/client';

import { therapistKeys } from './useTherapists';

export function useTherapist(key: string | undefined) {
  return useQuery<PublicEmployeeItem>({
    queryKey: key ? therapistKeys.detail(key) : therapistKeys.detail('__none__'),
    queryFn: () => publicEmployeesService.getByKey(key as string),
    enabled: Boolean(key),
  });
}
