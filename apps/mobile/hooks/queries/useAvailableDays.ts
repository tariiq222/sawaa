import { useQuery } from '@tanstack/react-query';
import { publicEmployeesService } from '@/services/client/employees';

export type AvailableDaysParams = Omit<Parameters<typeof publicEmployeesService.getAvailableDays>[0], 'employeeId' | 'branchId'> & {
  employeeId?: string;
  branchId?: string;
};

export const availableDaysKeys = {
  all: ['therapists', 'available-days'] as const,
  list: (params: AvailableDaysParams) => [...availableDaysKeys.all, params] as const,
};

export function useAvailableDays(params: AvailableDaysParams, enabled = true) {
  return useQuery({
    meta: { silentError: true },
    queryKey: availableDaysKeys.list(params),
    queryFn: () => publicEmployeesService.getAvailableDays({ ...params, employeeId: params.employeeId!, branchId: params.branchId! }),
    enabled: enabled && Boolean(params.employeeId && params.branchId),
  });
}
