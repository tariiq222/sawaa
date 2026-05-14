"use client"

import { useState, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "@/lib/api/departments"
import type { DepartmentListQuery } from "@/lib/types/department"

export function useDepartments() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: DepartmentListQuery = {
    page,
    perPage: 20,
    search: debouncedSearch || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.departments.list(query),
    queryFn: () => fetchDepartments(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    departments: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error instanceof Error ? error.message : null,
    page,
    setPage,
    search,
    setSearch: (s: string) => {
      setSearch(s)
      setPage(1)
    },
    isActive,
    setIsActive: (v: boolean | undefined) => {
      setIsActive(v)
      setPage(1)
    },
    resetFilters,
    refetch,
  }
}

/** Unfiltered stats for the StatsGrid — never changes with search/filter */
export function useDepartmentStats() {
  const query: DepartmentListQuery = { page: 1, perPage: 100 }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list(query),
    queryFn: () => fetchDepartments(query),
    staleTime: 5 * 60 * 1000,
  })
  const items = data?.items ?? []
  const now = new Date()
  return {
    isLoading,
    total: data?.meta?.total ?? 0,
    active: items.filter((d) => d.isActive).length,
    inactive: items.filter((d) => !d.isActive).length,
    newThisMonth: items.filter((d) => {
      const c = new Date(d.createdAt)
      return c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth()
    }).length,
  }
}

/** Flat list of active departments for use in dropdowns/selects */
export function useDepartmentOptions() {
  const query: DepartmentListQuery = { page: 1, perPage: 100, isActive: true }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list(query),
    queryFn: () => fetchDepartments(query),
    staleTime: 5 * 60 * 1000,
  })
  return {
    options: data?.items ?? [],
    isLoading,
  }
}

export function useDepartmentMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.departments.all })

  const createMut = useMutation({
    mutationFn: createDepartment,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Parameters<typeof updateDepartment>[1]) =>
      updateDepartment(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDepartment(id),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}
