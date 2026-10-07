import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { employeesService } from '@/services/employees';
import { therapistKeys } from './useTherapists';

export const employeeAvailabilityKeys = {
  all: ['employee', 'availability'] as const,
};

export function useEmployeeAvailability() {
  return useQuery({
    queryKey: employeeAvailabilityKeys.all,
    queryFn: employeesService.getAvailabilitySchedule,
    meta: { silentError: true },
  });
}

export function useUpdateEmployeeAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: employeesService.updateAvailabilitySchedule,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employeeAvailabilityKeys.all }),
        queryClient.invalidateQueries({ queryKey: [...therapistKeys.all, 'slots'] }),
        queryClient.invalidateQueries({ queryKey: [...therapistKeys.all, 'available-days'] }),
      ]);
    },
    // The editor displays its localized save error and retains the draft.
    onError: () => undefined,
  });
}
