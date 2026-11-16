/**
 * Chatbot API — Sawaa Dashboard
 * Controller: dashboard/comms/chat
 *
 * Only the legacy chat-session calls are covered here. Every response type is
 * derived from the committed OpenAPI snapshot (`lib/types/chatbot.ts`). The
 * request URLs, query params and bodies are unchanged byte for byte; the
 * `lib/api/openapi.ts` helper is intentionally not used for these two list
 * routes yet because they still send filter params the snapshot does not
 * document (see `ChatSessionListQuery`).
 */

import { api } from "@/lib/api"
import type {
  ChatSessionDetail,
  ChatSessionListQuery,
  ChatSessionListResponse,
  ChatbotConfig,
  EndChatSessionResult,
  SendStaffMessageResult,
  UpsertChatbotConfigPayload,
} from "@/lib/types/chatbot"

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

/** Closes the conversation and returns the raw `ChatConversation` row. */
export async function endChatSession(id: string): Promise<EndChatSessionResult> {
  return api.patch<EndChatSessionResult>(`/dashboard/comms/chat/conversations/${id}/close`)
}

/** Sends a staff reply and returns the raw `CommsChatMessage` row. */
export async function sendStaffMessage(id: string, body: string): Promise<SendStaffMessageResult> {
  return api.post<SendStaffMessageResult>(`/dashboard/comms/chat/conversations/${id}/messages`, { body })
}

export async function fetchChatSessions(
  query: ChatSessionListQuery = {},
): Promise<ChatSessionListResponse> {
  return api.get<ChatSessionListResponse>(
    "/dashboard/comms/chat/conversations",
    {
      page: query.page,
      limit: query.limit,
      handedOff:
        query.handedOff !== undefined ? String(query.handedOff) : undefined,
      language: query.language,
      fromDate: query.dateFrom,
      toDate: query.dateTo,
      search: query.search,
    },
  )
}
