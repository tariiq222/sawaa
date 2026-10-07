import { useQuery } from '@tanstack/react-query';

import { clientsService } from '@/services/clients';
import { employeeClientsKeys } from './useEmployeeClients';

export const employeeClientKeys = {
  detail: (id: string | undefined) => [...employeeClientsKeys.all, 'detail', id ?? '__none__'] as const,
  history: (id: string | undefined) => [...employeeClientsKeys.all, 'history', id ?? '__none__'] as const,
};

export function useEmployeeClient(id: string | undefined) {
  return useQuery({
    queryKey: employeeClientKeys.detail(id),
    queryFn: () => {
      if (!id) throw new Error('Client id is required');
      return clientsService.getById(id);
    },
    enabled: Boolean(id),
    meta: { silentError: true },
  });
}

export function useEmployeeClientHistory(id: string | undefined) {
  return useQuery({
    queryKey: employeeClientKeys.history(id),
    queryFn: () => {
      if (!id) throw new Error('Client id is required');
      return clientsService.getEmployeeBookings(id);
    },
    enabled: Boolean(id),
    meta: { silentError: true },
  });
}
