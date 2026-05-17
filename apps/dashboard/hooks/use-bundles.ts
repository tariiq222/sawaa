"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchBundles,
  fetchBundle,
  createBundle,
  updateBundle,
  deleteBundle,
} from "@/lib/api/bundles"
import type { BundleListQuery } from "@/lib/types/bundle"

/* ─── Bundles List ─── */

export function useBundlesList() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: BundleListQuery = {
    page,
    perPage: 20,
    search: debouncedSearch || undefined,
    isActive,
    includeHidden: true,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.bundles.list(query),
    queryFn: () => fetchBundles(query),
    staleTime: 5 * 60 * 1000,
  })

  const resetFilters = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  return {
    bundles: data?.items ?? [],
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

/* ─── Single Bundle ─── */

export function useBundle(id: string | null) {
  return useQuery({
    queryKey: queryKeys.bundles.detail(id ?? ""),
    queryFn: () => fetchBundle(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/* ─── Bundle Mutations ─── */

export function useBundleMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["bundles"], refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createBundle,
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string } & Parameters<typeof updateBundle>[1]) =>
      updateBundle(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: deleteBundle,
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}
