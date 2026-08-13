"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"
import {
  fetchConversation,
  fetchConversationMessages,
  fetchConversations,
} from "@/lib/api/conversations"
import { fetchUsers } from "@/lib/api/users"
import type {
  ConversationFilters,
  ConversationMessageFilters,
} from "@/lib/types/conversations"

export const CONVERSATION_POLL_INTERVAL = 7_500

// Kept local until the orchestrator applies the query-keys registration hunk.
export const conversationQueryKeys = {
  all: ["conversations"] as const,
  list: (filters: ConversationFilters = {}) => ["conversations", "list", filters] as const,
  detail: (conversationId: string) => ["conversations", "detail", conversationId] as const,
  messages: (conversationId: string, filters: ConversationMessageFilters = {}) =>
    ["conversations", "messages", conversationId, filters] as const,
  staff: ["conversations", "assignable-staff"] as const,
}

export function useConversations(filters: ConversationFilters = {}) {
  return useQuery({
    queryKey: conversationQueryKeys.list(filters),
    queryFn: () => fetchConversations(filters),
    staleTime: 5_000,
    refetchInterval: CONVERSATION_POLL_INTERVAL,
    placeholderData: keepPreviousData,
  })
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: conversationQueryKeys.detail(conversationId ?? ""),
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
    queryKey: conversationQueryKeys.messages(conversationId ?? "", filters),
    queryFn: () => fetchConversationMessages(conversationId!, filters),
    enabled: Boolean(conversationId),
    staleTime: 5_000,
    refetchInterval: CONVERSATION_POLL_INTERVAL,
  })
}

export function useAssignableConversationStaff(enabled: boolean) {
  return useQuery({
    queryKey: conversationQueryKeys.staff,
    queryFn: () => fetchUsers({ limit: 100, isActive: true }),
    enabled,
    staleTime: 5 * 60_000,
    select: (response) => response.items
      .filter((user) => ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"].includes(user.role))
      .map(({ id, name }) => ({ id, name })),
  })
}
