import { useQuery, keepPreviousData } from '@tanstack/react-query';

import { clientsService, type ClientRecord } from '@/services/clients';

export const employeeClientsKeys = {
  all: ['employee', 'clients'] as const,
  list: (search: string, limit: number) =>
    [...employeeClientsKeys.all, 'list', { search, limit }] as const,
};

interface UseEmployeeClientsParams {
  search?: string;
  limit?: number;
}

export function useEmployeeClients({ search = '', limit = 50 }: UseEmployeeClientsParams = {}) {
  return useQuery<ClientRecord[]>({
    queryKey: employeeClientsKeys.list(search, limit),
    queryFn: async () => {
      const res = await clientsService.getAll({ search: search || undefined, limit });
      return res.success ? (res.data.items ?? []) : [];
    },
    placeholderData: keepPreviousData,
  });
}
