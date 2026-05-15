/**
 * Chatbot API — Sawaa Dashboard
 * Controller: dashboard/comms/chat
 */

import { api } from "@/lib/api"
import type { PaginatedResponse } from "@/lib/types/common"
import type { ChatSession, ChatSessionDetail, ChatSessionListQuery, ChatbotConfig, UpsertChatbotConfigPayload } from "@/lib/types/chatbot"

export async function fetchChatbotConfig(): Promise<ChatbotConfig> {
  return api.get<ChatbotConfig>("/dashboard/ai/chatbot-config")
}

export async function upsertChatbotConfig(
  payload: UpsertChatbotConfigPayload,
): Promise<ChatbotConfig> {
  return api.patch<ChatbotConfig>("/dashboard/ai/chatbot-config", payload)
}

export async function fetchChatSession(id: string): Promise<ChatSessionDetail> {
  return api.get<ChatSessionDetail>(`/dashboard/comms/chat/conversations/${id}`)
}

export async function endChatSession(id: string): Promise<ChatSessionDetail> {
  return api.patch<ChatSessionDetail>(`/dashboard/comms/chat/conversations/${id}/close`)
}

export async function sendStaffMessage(id: string, body: string): Promise<{ id: string; body: string; createdAt: string }> {
  return api.post<{ id: string; body: string; createdAt: string }>(`/dashboard/comms/chat/conversations/${id}/messages`, { body })
}

export async function fetchChatSessions(
  query: ChatSessionListQuery = {},
): Promise<PaginatedResponse<ChatSession>> {
  return api.get<PaginatedResponse<ChatSession>>(
    "/dashboard/comms/chat/conversations",
    {
      page: query.page,
      limit: query.perPage,
      handedOff:
        query.handedOff !== undefined ? String(query.handedOff) : undefined,
      language: query.language,
      fromDate: query.dateFrom,
      toDate: query.dateTo,
      search: query.search,
    },
  )
}
