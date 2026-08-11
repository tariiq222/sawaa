"use client"

// whatsapp — dashboard queries for WhatsApp AI agent.
// Pure reads — invalidation lives in use-whatsapp-mutations.ts.

import { useQuery } from "@tanstack/react-query"
import {
  fetchWhatsappAgentConfig,
  fetchWhatsappConfig,
  fetchWhatsappConversation,
  fetchWhatsappQr,
  fetchWhatsappStatus,
  listWhatsappConversations,
  type ListWhatsappConversationsArgs,
} from "@/lib/api/whatsapp"
import type {
  WhatsappAgentConfigView,
  WhatsappConfigView,
  WhatsappConversationDetail,
  WhatsappConversationList,
  WhatsappQrView,
  WhatsappStatusView,
} from "@/lib/types/whatsapp"

// ── Config ──────────────────────────────────────────────────────────────

export function useWhatsappConfig() {
  const { data, isLoading, error } = useQuery<WhatsappConfigView>({
    queryKey: ["whatsapp", "config"],
    queryFn: fetchWhatsappConfig,
    staleTime: 60 * 1000,
  })
  return {
    config: data,
    loading: isLoading,
    error,
  }
}

export function useWhatsappAgentConfig() {
  const { data, isLoading, error } = useQuery<WhatsappAgentConfigView>({
    queryKey: ["whatsapp", "agent-config"],
    queryFn: fetchWhatsappAgentConfig,
    staleTime: 5 * 60 * 1000,
  })
  return {
    config: data,
    loading: isLoading,
    error,
  }
}

// ── Runtime ───────────────────────────────────────────────────────────

export function useWhatsappStatus() {
  const { data, isLoading, error } = useQuery<WhatsappStatusView>({
    queryKey: ["whatsapp", "status"],
    queryFn: fetchWhatsappStatus,
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000,
  })
  return {
    status: data,
    loading: isLoading,
    error,
  }
}

export function useWhatsappQr() {
  const { data, isLoading, isFetching, error, refetch } = useQuery<WhatsappQrView>({
    queryKey: ["whatsapp", "qr"],
    queryFn: fetchWhatsappQr,
    staleTime: 0,
    refetchInterval: 5 * 1000,
    refetchIntervalInBackground: false,
  })
  return {
    qr: data,
    loading: isLoading,
    isFetching,
    error,
    refetch,
  }
}

// ── Conversations ───────────────────────────────────────────────────

export function useWhatsappConversations(
  args: ListWhatsappConversationsArgs = {},
) {
  const { data, isLoading, error, refetch } = useQuery<WhatsappConversationList>({
    queryKey: ["whatsapp", "conversations", args],
    queryFn: () => listWhatsappConversations(args),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  })
  return {
    data: data?.items ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? Math.max(1, Math.ceil((data?.total ?? 0) / (args.pageSize ?? 20))),
    loading: isLoading,
    error,
    refetch,
  }
}

export function useWhatsappConversation(id: string | null) {
  const { data, isLoading, error, refetch } = useQuery<WhatsappConversationDetail>({
    queryKey: ["whatsapp", "conversation", id],
    queryFn: () => fetchWhatsappConversation(id as string),
    enabled: !!id,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
  })
  return {
    detail: data,
    loading: isLoading,
    error,
    refetch,
  }
}
