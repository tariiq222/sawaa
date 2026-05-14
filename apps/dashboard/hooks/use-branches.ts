"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  fetchBranchEmployees,
  assignEmployeeToBranch,
  unassignEmployeeFromBranch,
} from "@/lib/api/branches"
import type { BranchListQuery } from "@/lib/types/branch"

/* ─── Branches List ─── */

export function useBranches() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: BranchListQuery = {
    page,
    perPage: 50,
    search: debouncedSearch || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.branches.list(query),
    queryFn: () => fetchBranches(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    branches: data?.items ?? [],
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
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

/* ─── Branch Mutations ─── */

export function useBranchMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.branches.all })

  const createMut = useMutation({
    mutationFn: createBranch,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateBranch>[1]) =>
      updateBranch(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}

/* ─── Branch Employees ─── */

export function useBranchEmployees(branchId: string | null) {
  return useQuery({
    queryKey: queryKeys.branches.employees(branchId ?? ""),
    queryFn: () => fetchBranchEmployees(branchId!),
    enabled: !!branchId,
    staleTime: 60 * 1000,
  })
}

export function useBranchEmployeeMutations(branchId: string | null) {
  const queryClient = useQueryClient()
  const invalidate = () => {
    if (!branchId) return
    queryClient.invalidateQueries({ queryKey: queryKeys.branches.employees(branchId) })
  }

  const assignMut = useMutation({
    mutationFn: (employeeId: string) => assignEmployeeToBranch(branchId!, employeeId),
    onSuccess: invalidate,
  })

  const unassignMut = useMutation({
    mutationFn: (employeeId: string) => unassignEmployeeFromBranch(branchId!, employeeId),
    onSuccess: invalidate,
  })

  return { assignMut, unassignMut }
}
