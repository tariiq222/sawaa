"use client"

import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchEmployees,
  fetchEmployee,
  fetchAvailability,
  fetchBreaks,
  fetchVacations,
  fetchEmployeeServices,
  fetchEmployeeServiceTypes,
  fetchEmployeeAccount,
} from "@/lib/api/employees"
import type { EmployeeListQuery, EmployeeSortField } from "@/lib/types/employee"

/* ─── List Hook ─── */

const SORT_FIELDS: ReadonlyArray<EmployeeSortField> = [
  "name",
  "experience",
  "isActive",
  "createdAt",
]

function parseSortField(value: string | null): EmployeeSortField | undefined {
  return value && (SORT_FIELDS as ReadonlyArray<string>).includes(value)
    ? (value as EmployeeSortField)
    : undefined
}

function parseIsActive(value: string | null): boolean | undefined {
  if (value === "true") return true
  if (value === "false") return false
  return undefined
}

export function useEmployees() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlSearch = searchParams.get("search") ?? ""
  const urlIsActive = parseIsActive(searchParams.get("isActive"))
  const urlPage = Number(searchParams.get("page") ?? "1") || 1
  const urlSortBy = parseSortField(searchParams.get("sortBy"))
  const sortOrderRaw = searchParams.get("sortOrder")
  const urlSortOrder: "asc" | "desc" | undefined =
    sortOrderRaw === "desc"
      ? "desc"
      : sortOrderRaw === "asc"
        ? "asc"
        : undefined

  const [search, setSearchState] = useState(urlSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const updateParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key)
        else next.set(key, value)
      }
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  useEffect(() => {
    updateParams({
      search: debouncedSearch || undefined,
      page: debouncedSearch !== urlSearch ? "1" : undefined,
    })
  }, [debouncedSearch, updateParams, urlSearch])

  const setSearch = useCallback(
    (s: string) => {
      setSearchState(s)
    },
    [setSearchState]
  )

  const setIsActive = useCallback(
    (v: boolean | undefined) => {
      updateParams({
        isActive: v === undefined ? undefined : String(v),
        page: "1",
      })
    },
    [updateParams]
  )

  const setPage = useCallback(
    (p: number) => {
      updateParams({ page: p === 1 ? undefined : String(p) })
    },
    [updateParams]
  )

  const setSort = useCallback(
    (
      sortBy: EmployeeSortField | undefined,
      sortOrder: "asc" | "desc" | undefined
    ) => {
      updateParams({ sortBy, sortOrder })
    },
    [updateParams]
  )

  const query: EmployeeListQuery = {
    page: urlPage,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive: urlIsActive,
    sortBy: urlSortBy,
    sortOrder: urlSortOrder,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.employees.list(query),
    queryFn: () => fetchEmployees(query),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearchState("")
    setDebouncedSearch("")
    router.replace(pathname, { scroll: false })
  }, [pathname, router, setDebouncedSearch, setSearchState])

  const hasFilters = !!(
    debouncedSearch ||
    urlIsActive !== undefined ||
    urlSortBy
  )

  return {
    employees: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page: urlPage,
    setPage,
    search,
    setSearch,
    isActive: urlIsActive,
    setIsActive,
    sortBy: urlSortBy,
    sortOrder: urlSortOrder,
    setSort,
    hasFilters,
    resetFilters,
    refetch,
  }
}

/* ─── Detail Hook ─── */

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id!),
    queryFn: () => fetchEmployee(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

/* ─── Availability Query ─── */

export function useEmployeeAvailability(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.availability(id!),
    queryFn: () => fetchAvailability(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Breaks Query ─── */

export function useEmployeeBreaks(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.breaks(id!),
    queryFn: () => fetchBreaks(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Vacations Query ─── */

export function useEmployeeVacations(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.vacations(id!),
    queryFn: () => fetchVacations(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Employee Services Query ─── */

export function useEmployeeServices(id: string | null) {
  return useQuery({
    queryKey: queryKeys.employees.services(id!),
    queryFn: () => fetchEmployeeServices(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Employee Service Types Query ─── */

export function useEmployeeServiceTypes(
  employeeId: string | null,
  serviceId: string | null
) {
  const enabled = !!employeeId && !!serviceId
  return useQuery({
    queryKey: queryKeys.employees.serviceTypes(
      employeeId ?? "",
      serviceId ?? ""
    ),
    queryFn: () => fetchEmployeeServiceTypes(employeeId!, serviceId!),
    enabled,
  })
}

/* ─── Employee Account Query ─── */

export function useEmployeeAccount(employeeId: string) {
  return useQuery({
    queryKey: queryKeys.employees.account(employeeId),
    queryFn: () => fetchEmployeeAccount(employeeId),
    staleTime: 5 * 60 * 1000,
  })
}
