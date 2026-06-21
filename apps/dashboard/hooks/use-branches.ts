"use client"

import { useQuery } from "@tanstack/react-query"
import { useState, useCallback, useEffect } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchBranches } from "@/lib/api/branches"
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
