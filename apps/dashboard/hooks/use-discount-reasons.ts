"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchDiscountReasons,
  createDiscountReason,
  updateDiscountReason,
  deleteDiscountReason,
} from "@/lib/api/discount-reasons"
import type {
  CreateDiscountReasonInput,
  UpdateDiscountReasonInput,
} from "@/lib/types/discount-reason"

export function useDiscountReasons(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.discountReasons.list(includeInactive),
    queryFn: () => fetchDiscountReasons(includeInactive),
    staleTime: 5 * 60 * 1000,
  })
}

export function useDiscountReasonMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.discountReasons.all })

  const createMut = useMutation({
    mutationFn: (payload: CreateDiscountReasonInput) => createDiscountReason(payload),
    onSuccess: invalidate,
  })

  const updateMut = useMutation({
    mutationFn: ({ id, ...payload }: UpdateDiscountReasonInput & { id: string }) =>
      updateDiscountReason(id, payload),
    onSuccess: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDiscountReason(id),
    onSuccess: invalidate,
  })

  return { createMut, updateMut, deleteMut }
}
