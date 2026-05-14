"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { fetchKnowledgeBase, fetchKnowledgeFiles } from "@/lib/api/chatbot-kb"
import { fetchChatbotConfig } from "@/lib/api/chatbot"
import type {
  KnowledgeBaseQuery,
  KbSource,
  ChatbotConfigEntry,
} from "@/lib/types/chatbot"

export function useKnowledgeBase() {
  const [page, setPage] = useState(1)
  const [source, setSource] = useState<KbSource | undefined>()
  const [category, setCategory] = useState<string | undefined>()

  const filters: KnowledgeBaseQuery = { page, perPage: 20, source, category }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.knowledgeBase.list(filters),
    queryFn: () => fetchKnowledgeBase(filters),
    staleTime: 30 * 1000,
  })

  const setFilters = (f: { source?: KbSource; category?: string }) => {
    setSource(f.source)
    setCategory(f.category)
    setPage(1)
  }

  const resetFilters = () => {
    setSource(undefined)
    setCategory(undefined)
    setPage(1)
  }

  return {
    entries: data?.items ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    filters: { source, category },
    setFilters,
    resetFilters,
    setPage,
    hasFilters: !!(source ?? category),
  }
}

export function useKnowledgeFiles() {
  const [page, setPage] = useState(1)
  const filters = { page, perPage: 20 }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.files.list(filters),
    queryFn: () => fetchKnowledgeFiles(filters),
    staleTime: 30 * 1000,
  })

  return {
    files: data?.items ?? [],
    meta: data?.meta ?? null,
    loading: isLoading,
    error: error?.message ?? null,
    setPage,
  }
}

export function useChatbotConfig(category?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.chatbot.config.list(category),
    queryFn: () => fetchChatbotConfig(category),
    staleTime: 5 * 60 * 1000,
  })
  return {
    config: data ?? ([] as ChatbotConfigEntry[]),
    loading: isLoading,
    error: error?.message ?? null,
  }
}
