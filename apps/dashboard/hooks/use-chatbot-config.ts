"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchKnowledgeBase } from "@/lib/api/chatbot-kb"
import { fetchChatbotConfig } from "@/lib/api/chatbot"
import type {
  KnowledgeBaseQuery,
  KbDocumentStatus,
  ChatbotConfig,
} from "@/lib/types/chatbot"

export function useKnowledgeBase() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<KbDocumentStatus | undefined>()

  const filters: KnowledgeBaseQuery = { page, limit: 20, status }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.knowledgeBase.list(filters),
    queryFn: () => fetchKnowledgeBase(filters),
    staleTime: 30 * 1000,
  })

  const setFilters = (f: { status?: KbDocumentStatus }) => {
    setStatus(f.status)
    setPage(1)
  }

  const resetFilters = () => {
    setStatus(undefined)
    setPage(1)
  }

  return {
    entries: data?.data ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    filters: { status },
    setFilters,
    resetFilters,
    setPage,
    hasFilters: !!status,
  }
}

export function useChatbotConfig() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.config.list(),
    queryFn: () => fetchChatbotConfig(),
    staleTime: 5 * 60 * 1000,
  })
  return {
    config: data ?? null as ChatbotConfig | null,
    loading: isLoading,
    error: error?.message ?? null,
  }
}
