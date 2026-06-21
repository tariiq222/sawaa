"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toastApiError } from "@/lib/mutation-helpers"
import { fetchGroupPrograms, createGroupProgram } from "@/lib/api/group-programs"
import type { GroupProgramListQuery } from "@/lib/types/group-program"

/* ─── List Hook ─── */

export function useGroupPrograms(query: GroupProgramListQuery = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.groupPrograms.list(query),
    queryFn: () => fetchGroupPrograms(query),
    staleTime: 10_000,
  })

  return {
    programs: data ?? [],
    isLoading,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  }
}

/* ─── Mutations ─── */

export function useGroupProgramMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.groupPrograms.all, refetchType: "all" })

  const createMut = useMutation({
    mutationFn: createGroupProgram,
    onSuccess: invalidate,
    onError: toastApiError("فشل إنشاء البرنامج الجماعي"),
  })

  return { createMut }
}
