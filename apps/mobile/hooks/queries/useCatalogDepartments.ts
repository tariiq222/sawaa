import { useQuery } from '@tanstack/react-query';

import {
  mapCatalogDepartments,
  publicCatalogService,
  type PublicCatalogDepartment,
  type PublicCatalogRaw,
} from '@/services/client/catalog';

export const catalogKeys = {
  all: ['public', 'services'] as const,
  departments: () => catalogKeys.all,
};

export function usePublicCatalog(enabled = true) {
  return useQuery<PublicCatalogRaw>({
    queryKey: catalogKeys.all,
    queryFn: () => publicCatalogService.getCatalog(),
    enabled,
  });
}

export function useCatalogDepartments(enabled = true) {
  return useQuery<PublicCatalogRaw, Error, PublicCatalogDepartment[]>({
    queryKey: catalogKeys.departments(),
    queryFn: () => publicCatalogService.getCatalog(),
    select: mapCatalogDepartments,
    enabled,
  });
}
