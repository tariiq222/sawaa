"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchServices,
  fetchServicesListStats,
  fetchCategories,
  createService,
  updateService,
  deleteService,
  createCategory,
  updateCategory,
  deleteCategory,
  fetchDurationOptions,
  setDurationOptions,
  fetchServiceBookingTypes,
  setServiceBookingTypes,
  fetchServiceEmployees,
} from "@/lib/api/services"
import {
  fetchIntakeForms as fetchIntakeFormsApi,
  createIntakeForm as createIntakeFormApi,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
} from "@/lib/api/intake-forms"
import { assignService } from "@/lib/api/employees"
import type { AssignServicePayload } from "@/lib/types/employee"
import type { ServiceListQuery, CategoryListQuery } from "@/lib/types/service"
import type {
  SetDurationOptionsPayload,
  SetServiceBookingTypesPayload,
  CreateIntakeFormPayload,
} from "@/lib/types/service-payloads"
import type {
  UpdateIntakeFormApiPayload,
  SetFieldsApiPayload,
  IntakeFormApi,
} from "@/lib/types/intake-form-api"

/* ─── Services List ─── */

export function useServices() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: ServiceListQuery = {
    page,
    perPage: 20,
    search: debouncedSearch || undefined,
    categoryId,
    isActive,
    includeHidden: true, // Admin dashboard shows all services
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.list(query),
    queryFn: () => fetchServices(query),
    staleTime: 5 * 60 * 1000, // 5 min
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setCategoryId(undefined)
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    services: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    categoryId,
    setCategoryId: (id: string | undefined) => { setCategoryId(id); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetFilters,
    refetch,
  }
}

/* ─── Services List Stats ─── */

export function useServicesListStats() {
  return useQuery({
    queryKey: queryKeys.services.listStats(),
    queryFn: fetchServicesListStats,
    staleTime: 30 * 1000,
  })
}

/* ─── Categories ─── */

/** Flat list of all categories — used by selects/dropdowns in service forms. */
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.services.categories({ all: true }),
    queryFn: async () => {
      const res = await fetchCategories({ page: 1, perPage: 200 })
      return res.items
    },
    staleTime: 30 * 60 * 1000, // 30 min — categories rarely change
  })
}

/** Server-driven list hook for the categories admin page (search, status, pagination). */
export function useCategoriesList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: CategoryListQuery = {
    page,
    perPage: 20,
    search: debouncedSearch || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.services.categories(query),
    queryFn: () => fetchCategories(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    categories: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetFilters,
    refetch,
  }
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

/* ─── Category Mutations ─── */

export function useCategoryMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["services", "categories"] })

  const createMut = useMutation({
    mutationFn: createCategory,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateCategory>[1]) =>
      updateCategory(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}


/* ─── Duration Options ─── */

export function useDurationOptions(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.durationOptions(serviceId ?? ""),
    queryFn: () => fetchDurationOptions(serviceId!),
    enabled: !!serviceId,
  })
}

export function useDurationOptionsMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: string; payload: SetDurationOptionsPayload }) =>
      setDurationOptions(serviceId, payload),
    onSuccess: (_data, { serviceId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.durationOptions(serviceId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.services.all })
    },
  })
}

/* ─── Booking Types ─── */

export function useServiceBookingTypes(serviceId: string | null) {
  return useQuery({
    queryKey: queryKeys.services.bookingTypes(serviceId!),
    queryFn: () => fetchServiceBookingTypes(serviceId!),
    enabled: !!serviceId,
  })
}

export function useServiceBookingTypesMutation(serviceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: SetServiceBookingTypesPayload) =>
      setServiceBookingTypes(serviceId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.services.bookingTypes(serviceId) })
    },
  })
}

/* ─── Intake Forms ─── */

export function useIntakeForms(serviceId: string | null): ReturnType<typeof useQuery<IntakeFormApi[]>> {
  return useQuery({
    queryKey: queryKeys.services.intakeForms(serviceId ?? ""),
    queryFn: () => fetchIntakeFormsApi(),
    enabled: !!serviceId,
  })
}

export function useIntakeFormMutations(serviceId: string) {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.services.intakeForms(serviceId) })

  const createMut = useMutation({
    mutationFn: (payload: CreateIntakeFormPayload) =>
      createIntakeFormApi({ nameAr: payload.nameAr, nameEn: payload.nameEn ?? payload.nameAr, type: "pre_booking", scope: "service", isActive: payload.isActive }),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ formId, payload }: { formId: string; payload: UpdateIntakeFormApiPayload }) =>
      updateIntakeForm(formId, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteIntakeForm,
    onSuccess: invalidate,
  })

  const setFieldsMut = useMutation({
    mutationFn: ({ formId, payload }: { formId: string; payload: SetFieldsApiPayload }) =>
      setIntakeFields(formId, payload),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut, setFieldsMut }
}

/* ─── Service Employees Hook ─── */

export function useServiceEmployees(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Assign Employees to Service ─── */

export function useAssignEmployeesToService(serviceId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (employeeIds: string[]) =>
      Promise.all(
        employeeIds.map((employeeId) =>
          assignService(employeeId, {
            serviceId,
            availableTypes: ["in_person", "online"],
            isActive: true,
          } satisfies AssignServicePayload),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.services.employees(serviceId),
      })
    },
  })
}

