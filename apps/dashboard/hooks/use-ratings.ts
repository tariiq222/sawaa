"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api"
import { fetchAllRatings, updateRatingVisibility } from "@/lib/api/employees"
import { queryKeys } from "@/lib/query-keys"
import type { PaginatedResponse } from "@/lib/types/common"
import type { Rating } from "@/lib/types/rating"

/* ─── Query ─── */

export function useRatings({ page = 1, perPage = 20 }: { page?: number; perPage?: number } = {}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.ratings.list({ page, perPage }),
    queryFn: () => fetchAllRatings({ page, perPage }),
    staleTime: 60_000,
  })

  const errorMessage = error
    ? error instanceof ApiError
      ? error.message
      : (error.message ?? null)
    : null

  return {
    ratings: data?.items ?? [] as Rating[],
    meta: data?.meta ?? null as PaginatedResponse<Rating>["meta"] | null,
    isLoading,
    error: errorMessage,
    refetch,
  }
}

/* ─── Mutations ─── */

export function useRatingMutations() {
  const queryClient = useQueryClient()

  const updateVisibility = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      updateRatingVisibility(id, isPublic),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ratings.all })
    },
  })

  return { updateVisibility }
}
