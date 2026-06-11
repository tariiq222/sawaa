import { useQuery } from '@tanstack/react-query';

import { publicCatalogService } from '@/services/client/catalog';
import { publicEmployeesService } from '@/services/client/employees';
import { deriveClinics, type ClinicEntry } from '@/lib/clinics';

export const clinicKeys = { list: ['clinics', 'list'] as const };

export function useClinics() {
  return useQuery<ClinicEntry[]>({
    queryKey: clinicKeys.list,
    queryFn: async () => {
      const [catalog, employees] = await Promise.all([
        publicCatalogService.getCatalog(),
        publicEmployeesService.list(),
      ]);
      return deriveClinics(catalog, employees);
    },
  });
}
