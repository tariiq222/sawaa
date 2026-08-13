"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  fetchConversation,
  fetchConversationMessages,
  fetchConversations,
} from "@/lib/api/conversations"
import { fetchUsers } from "@/lib/api/users"
import { queryKeys } from "@/lib/query-keys"
import type {
  ConversationFilters,
  ConversationMessageFilters,
} from "@/lib/types/conversations"

export const CONVERSATION_POLL_INTERVAL = 7_500

export function useConversations(filters: ConversationFilters = {}) {
  return useQuery({
    queryKey: queryKeys.conversations.list(filters),
    queryFn: () => fetchConversations(filters),
    staleTime: 5_000,
    refetchInterval: CONVERSATION_POLL_INTERVAL,
    placeholderData: keepPreviousData,
  })
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(conversationId ?? ""),
    queryFn: () => fetchConversation(conversationId!),
    enabled: Boolean(conversationId),
    staleTime: 5_000,
    refetchInterval: CONVERSATION_POLL_INTERVAL,
  })
}

export function useConversationMessages(
  conversationId: string | null,
  filters: ConversationMessageFilters = { limit: 100 },
) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId ?? "", filters),
    queryFn: () => fetchConversationMessages(conversationId!, filters),
    enabled: Boolean(conversationId),
    staleTime: 5_000,
    refetchInterval: CONVERSATION_POLL_INTERVAL,
  })
}

export function useAssignableConversationStaff(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.conversations.staff(),
    queryFn: () => fetchUsers({ limit: 100, isActive: true }),
    enabled,
    staleTime: 5 * 60_000,
    select: (response) => response.items
      .filter((user) => ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"].includes(user.role))
      .map(({ id, name }) => ({ id, name })),
  })
}
