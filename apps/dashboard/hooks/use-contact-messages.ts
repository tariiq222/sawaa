"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
  fetchContactMessages,
  updateContactMessageStatus,
  type ContactMessageListQuery,
  type ContactMessageStatus,
} from "@/lib/api/contact-messages"

export function useContactMessages(query: ContactMessageListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.contactMessages.list(query),
    queryFn: () => fetchContactMessages(query),
    staleTime: 30_000,
  })
}

export function useUpdateContactMessageStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ContactMessageStatus }) =>
      updateContactMessageStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactMessages.all })
    },
  })
}
