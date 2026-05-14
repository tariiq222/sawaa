"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { addToWaitlist, fetchWaitlist } from "@/lib/api/waitlist"
import type { AddToWaitlistPayload } from "@/lib/api/waitlist"
import type { WaitlistEntry } from "@/lib/types/waitlist"
import type { UseQueryResult } from "@tanstack/react-query"

/* ─── Waitlist Query ─── */

export function useWaitlist(status?: string): UseQueryResult<WaitlistEntry[]> {
  return useQuery({
    queryKey: queryKeys.waitlist.list({ status }),
    queryFn: () => fetchWaitlist(status ? { status } : undefined),
    staleTime: 30_000,
  })
}

/* ─── Waitlist Mutations ─── */

export function useWaitlistMutations() {
  const queryClient = useQueryClient()
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.waitlist.all })

  const addMut = useMutation({
    mutationFn: (payload: AddToWaitlistPayload) => addToWaitlist(payload),
    onSuccess: invalidate,
  })

  return { addMut }
}
