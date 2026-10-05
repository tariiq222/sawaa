'use client'
import { useQuery } from '@tanstack/react-query'
import { fetchBookings } from '@/lib/api/bookings'
import { fetchServices } from '@/lib/api/services'
import { fetchEmployees } from '@/lib/api/employees'
import { fetchBranches } from '@/lib/api/branches'
import type { PaginatedResponse } from '@/lib/types/common'
import { queryKeys } from '@/lib/query-keys'

async function allPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>
) {
  const first = await fetchPage(1)
  const items = [...first.items]
  let response = first
  while (
    response.meta.hasNextPage ||
    response.meta.page < response.meta.totalPages
  ) {
    response = await fetchPage(response.meta.page + 1)
    items.push(...response.items)
  }
  return { ...first, items }
}

export function useLateSessionCatalog() {
  const serviceQuery = {
    limit: 200,
    includeHidden: true,
    historicalContext: true,
  }
  const employeeQuery = { limit: 200, historicalContext: true }
  const services = useQuery({
    queryKey: [...queryKeys.services.list(serviceQuery), 'all-pages'],
    queryFn: () => allPages((page) => fetchServices({ ...serviceQuery, page })),
    staleTime: 60000,
  })
  const employees = useQuery({
    queryKey: [...queryKeys.employees.list(employeeQuery), 'all-pages'],
    queryFn: () =>
      allPages((page) => fetchEmployees({ ...employeeQuery, page })),
    staleTime: 60000,
  })
  const branches = useQuery({
    queryKey: [...queryKeys.branches.all, 'late-entry', 'all-pages'],
    queryFn: () => allPages((page) => fetchBranches({ page, limit: 200 })),
    staleTime: 60000,
  })
  return {
    services: services.data?.items ?? [],
    employees: employees.data?.items ?? [],
    branches: branches.data?.items ?? [],
    loading: services.isLoading || employees.isLoading || branches.isLoading,
    error: services.error || employees.error || branches.error,
  }
}

export function useLateSessionExistingBookings(
  search: string,
  enabled: boolean,
  clientId?: string
) {
  const query = {
    search: search || undefined,
    clientId: clientId || undefined,
    limit: 200,
  }
  return useQuery({
    queryKey: [...queryKeys.bookings.list(query), 'all-pages'],
    queryFn: () => allPages((page) => fetchBookings({ ...query, page })),
    enabled,
    staleTime: 10000,
  })
}
