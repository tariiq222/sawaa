"use client"
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchEmployees } from '@/lib/api/employees'
import { fetchServices } from '@/lib/api/services'
import { fetchBranches } from '@/lib/api/branches'
import type { FormScope } from '@/lib/types/intake-form'

export function useIntakeScopeOptions(scope: FormScope, locale: 'ar' | 'en') {
  return useInfiniteQuery({
    queryKey: ['intake-forms', 'scope-options', scope, locale],
    enabled: scope !== 'global',
    initialPageParam: 1,
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const query = { page: pageParam, limit: 100 }
      if (scope === 'employee') {
        const response = await fetchEmployees(query)
        return { ...response, items: response.items.map(e => ({ value: e.id, label: (locale === 'ar' ? e.nameAr : e.nameEn) || `${e.user.firstName} ${e.user.lastName}`.trim() })) }
      }
      if (scope === 'service') {
        const response = await fetchServices(query)
        return { ...response, items: response.items.map(s => ({ value: s.id, label: locale === 'ar' ? s.nameAr : s.nameEn || s.nameAr })) }
      }
      const response = await fetchBranches(query)
      return { ...response, items: response.items.map(b => ({ value: b.id, label: locale === 'ar' ? b.nameAr : b.nameEn || b.nameAr })) }
    },
    getNextPageParam: last => last.meta.hasNextPage ? last.meta.page + 1 : undefined,
  })
}
