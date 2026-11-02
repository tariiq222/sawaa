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
  uploadServiceImage,
  DEFAULT_SERVICES_LIST_QUERY,
} from "@/lib/api/services"
import type { ServiceListQuery } from "@/lib/types/service"
import { signedImageQueryOptions } from "@/lib/signed-url-policy"

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
  const [branchId, setBranchId] = useState<string | undefined>()
  const [sortBy, setSortBy] = useState<ServiceListQuery["sortBy"]>("createdAt")
  const [sortOrder, setSortOrder] = useState<ServiceListQuery["sortOrder"]>("desc")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(handle)
  }, [search])

  const query: ServiceListQuery = {
    ...DEFAULT_SERVICES_LIST_QUERY,
    page, sortBy, sortOrder,
    ...(branchId ? { branchId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.list(query),
    queryFn: () => fetchServices(query),
    placeholderData: (previousData) => previousData,
    // Response payloads carry presigned image URLs (service + category) that
    // expire after 5 minutes — see lib/signed-url-policy.ts.
    ...signedImageQueryOptions,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setCategoryId(undefined)
    setDepartmentId(undefined)
    setBranchId(undefined)
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
    branchId,
    setBranchId: (id: string | undefined) => { setBranchId(id); setPage(1) },
    sortBy, sortOrder,
    setSorting: (field: ServiceListQuery["sortBy"], order: ServiceListQuery["sortOrder"]) => { setSortBy(field); setSortOrder(order); setPage(1) },
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
    queryKey: [...queryKeys.services.all, "picker", { includeHidden: true }],
    // Package items must be able to reference direct-booking clinics, which
    // book through a hidden internal service.
    queryFn: () => fetchServices({ page: 1, limit: 100, includeHidden: true }),
    // Same presigned image URLs as the services list.
    ...signedImageQueryOptions,
  })
  return { data: data?.items ?? [], isLoading, error }
}

export function useServicesListStats() {
  // No signed URLs in this payload (counts only) — keep provider defaults.
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

/* ─── Service Image Upload ─── */

export interface ServiceImageUploadVariables {
  serviceId: string
  file: File
  /**
   * Id used by the *detail* query key of the open edit screen. The edit route
   * param may be a readable ref (e.g. `SVC-12`) while the API needs the UUID.
   */
  detailId?: string
}

/**
 * Uploads a service image and reconciles every cache that showed the old one.
 *
 * The PATCH inside `uploadServiceImage` returns the refreshed Service (with a
 * freshly presigned `imageUrl`), so we seed the open detail cache directly
 * instead of hoping a list refetch lands after the upload. The edit form's own
 * `updateMut` invalidation can complete *before* the upload even starts
 * (T8-F1), which is why this post-upload pass is what actually carries the new
 * image; remounting the page must never be required (T10-F3).
 */
export function useServiceImageUpload() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ serviceId, file }: ServiceImageUploadVariables) =>
      uploadServiceImage(serviceId, file),
    onSuccess: (updatedService, variables) => {
      queryClient.setQueryData(
        queryKeys.services.detail(variables.detailId ?? updatedService.id),
        updatedService,
      )
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all, refetchType: "all" })
      // Package screens embed service rows in their item pickers.
      queryClient.invalidateQueries({ queryKey: queryKeys.packages.all, refetchType: "all" })
    },
  })
}
