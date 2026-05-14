"use client"

import { useQuery, useQueryClient, useMutation, keepPreviousData } from "@tanstack/react-query"
import { useState, useEffect, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import { fetchClients, fetchClient, updateClient, createWalkInClient, deleteClient } from "@/lib/api/clients"
import type { ClientListQuery } from "@/lib/types/client"

/* ─── List Hook ─── */

export function useClients() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isActive, setIsActive] = useState<boolean | undefined>()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const query: ClientListQuery = {
    page,
    perPage: 20,
    search: debouncedSearch || undefined,
    isActive,
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.clients.list(query),
    queryFn: () => fetchClients(query),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })

  const resetSearch = useCallback(() => {
    setSearch("")
    setDebouncedSearch("")
    setIsActive(undefined)
    setPage(1)
  }, [])

  const items = data?.items ?? []

  return {
    clients: items,
    meta: data?.meta ?? null,
    isLoading,
    error: error?.message ?? null,
    page,
    setPage,
    search,
    setSearch: (s: string) => { setSearch(s); setPage(1) },
    isActive,
    setIsActive: (v: boolean | undefined) => { setIsActive(v); setPage(1) },
    resetSearch,
    refetch,
  }
}

/* ─── Stats Hook (unfiltered — for StatsGrid) ─── */

export function useClientStats() {
  const query: ClientListQuery = { page: 1, perPage: 200 }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.clients.list(query),
    queryFn: () => fetchClients(query),
    staleTime: 5 * 60 * 1000,
  })
  const items = data?.items ?? []
  const now = new Date()
  return {
    isLoading,
    total: data?.meta?.total ?? 0,
    active: items.filter((c) => c.isActive).length,
    inactive: items.filter((c) => !c.isActive).length,
    newThisMonth: items.filter((c) => {
      const d = new Date(c.createdAt)
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }).length,
  }
}

/* ─── Detail Hook ─── */

export function useClient(id: string | null) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id!),
    queryFn: () => fetchClient(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
}

/* ─── Mutations ─── */

export function useClientMutations() {
  const queryClient = useQueryClient()
  // Invalidate active queries (currently-mounted list/detail) AND mark inactive
  // entries stale so the next mount (e.g. after router.push back to /clients)
  // refetches fresh data instead of serving the pre-mutation cached list.
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.clients.all,
      refetchType: "all",
    })

  const createMut = useMutation({
    mutationFn: createWalkInClient,
    onSuccess: () => invalidate(),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof updateClient>[1] }) =>
      updateClient(id, payload),
    onSuccess: () => invalidate(),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteClient(id),
    onSuccess: () => invalidate(),
  })

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateClient(id, { isActive }),
    onSuccess: () => invalidate(),
  })

  return { createMut, updateMut, deleteMut, toggleActiveMut }
}

/* ─── Invalidation ─── */

export function useInvalidateClients() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clients.all })
}
