"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchPackages,
  fetchPackage,
  createPackage,
  updatePackage,
  deletePackage,
} from "@/lib/api/packages"
import type { PackageListQuery } from "@/lib/types/package"

/* ─── Packages List ─── */

export function usePackagesList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: PackageListQuery = {
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.packages.list(query),
    queryFn: () => fetchPackages(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    packages: data?.items ?? [],
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

/* ─── Single Package ─── */

export function usePackage(id: string | null) {
  return useQuery({
    queryKey: queryKeys.packages.detail(id ?? ""),
    queryFn: () => fetchPackage(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Package Mutations ─── */

export function usePackageMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.packages.all, refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createPackage,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updatePackage>[1]) =>
      updatePackage(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deletePackage,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}
