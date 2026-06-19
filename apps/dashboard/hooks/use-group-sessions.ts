"use client"

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import { useState, useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchGroupSessions,
  fetchGroupSession,
  createGroupSession,
  cancelGroupSession,
} from "@/lib/api/group-sessions"
import type { GroupSessionStatus } from "@/lib/types/group-session"

/* ─── Filters ─── */

interface GroupSessionFilters {
  status: GroupSessionStatus | "all"
  upcoming: boolean
}

const defaultFilters: GroupSessionFilters = {
  status: "all",
  upcoming: false,
}

/* ─── List Hook ─── */

export function useGroupSessions() {
  const [page, setPage] = useState(1)
  const [filters, setFiltersState] = useState<GroupSessionFilters>(defaultFilters)

  const hasFilters = filters.status !== "all" || filters.upcoming

  const query = {
    page,
    limit: 20,
    status: filters.status !== "all" ? filters.status : undefined,
    upcoming: filters.upcoming || undefined,
  }

  const {
    data: sessionsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.groupSessions.list(query),
    queryFn: () => fetchGroupSessions(query),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const setFilters = useCallback((partial: Partial<GroupSessionFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }))
    setPage(1)
  }, [])

  const resetFilters = useCallback(() => {
    setFiltersState(defaultFilters)
    setPage(1)
  }, [])

  return {
    sessions: sessionsData?.items ?? [],
    meta: sessionsData?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    filters,
    setFilters,
    resetFilters,
    setPage,
    hasFilters,
  }
}

/* ─── Detail Hook ─── */

export function useGroupSession(id: string | null) {
  return useQuery({
    queryKey: queryKeys.groupSessions.detail(id ?? ""),
    queryFn: () => fetchGroupSession(id!),
    enabled: !!id,
    staleTime: 10_000,
  })
}

/* ─── Mutations ─── */

export function useGroupSessionMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupSessions.all, refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createGroupSession,
    onSuccess: invalidate,
  })

  const cancelMut = useMutation({
    mutationFn: ({ id, ...payload }: { id: string; cancelReason?: string }) =>
      cancelGroupSession(id, payload),
    onSuccess: invalidate,
  })

  return { createMut, cancelMut }
}
