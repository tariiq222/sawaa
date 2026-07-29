"use client"

import { useState, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchServices,
  fetchServicesListStats,
  createService,
  updateService,
  deleteService,
  DEFAULT_SERVICES_LIST_QUERY,
} from "@/lib/api/services"
import type { ServiceListQuery } from "@/lib/types/service"

// Re-exports from split files (kept for backward compatibility).
// New code should import from the dedicated hook files directly:
//   - @/hooks/use-categories         (categories list + mutations)
//   - @/hooks/use-service-extras     (duration options, booking types)
//   - @/hooks/use-service-employees  (service-employee assignment)
export { useCategories, useCategoriesList, useCategoryMutations } from "./use-categories"
export {
  useDurationOptions,
  useDurationOptionsMutation,
  useServiceBookingTypes,
  useServiceBookingTypesMutation,
} from "./use-service-extras"
export { useServiceEmployees, useAssignEmployeesToService } from "./use-service-employees"

/* ─── Services List ─── */

export function useServices() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [departmentId, setDepartmentId] = useState<string | undefined>()
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const query: ServiceListQuery = {
    ...DEFAULT_SERVICES_LIST_QUERY,
    page,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.list(query),
    queryFn: () => fetchServices(query),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setCategoryId(undefined)
    setDepartmentId(undefined)
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    services: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    categoryId,
    setCategoryId: (id: string | undefined) => { setCategoryId(id); setPage(1) },
    departmentId,
    setDepartmentId: (id: string | undefined) => { setDepartmentId(id); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

export function useAllServices() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.services.all,
    queryFn: () => fetchServices({ page: 1, limit: 100 }),
    staleTime: 5 * 60 * 1000,
  })
  return { data: data?.items ?? [], isLoading, error }
}

export function useServicesListStats() {
  return useQuery({
    queryKey: queryKeys.services.listStats(),
    queryFn: () => fetchServicesListStats(),
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Service Mutations ─── */

export function useServiceMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.services.all, refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createService,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateService>[1]) =>
      updateService(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteService,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}