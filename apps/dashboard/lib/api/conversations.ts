import { api } from "@/lib/api"
import type {
  Conversation,
  ConversationFilters,
  ConversationListResponse,
  ConversationMessage,
  ConversationMessageFilters,
  ConversationMessagesResponse,
  MarkConversationReadPayload,
  ReplyConversationPayload,
} from "@/lib/types/conversations"

const endpoint = (conversationId: string, action = "") =>
  `/dashboard/conversations/${conversationId}${action}`

export function fetchConversations(
  filters: ConversationFilters = {},
): Promise<ConversationListResponse> {
  return api.get<ConversationListResponse>("/dashboard/conversations", { ...filters })
}

export function fetchConversation(conversationId: string): Promise<Conversation> {
  return api.get<Conversation>(endpoint(conversationId))
}

export function fetchConversationMessages(
  conversationId: string,
  filters: ConversationMessageFilters = {},
): Promise<ConversationMessagesResponse> {
  return api.get<ConversationMessagesResponse>(endpoint(conversationId, "/messages"), { ...filters })
}

export function claimConversation(conversationId: string): Promise<Conversation> {
  return api.post<Conversation>(endpoint(conversationId, "/claim"))
}

export function replyToConversation(
  conversationId: string,
  payload: ReplyConversationPayload,
): Promise<ConversationMessage> {
  return api.post<ConversationMessage>(endpoint(conversationId, "/messages"), payload)
}

export function assignConversation(
  conversationId: string,
  targetStaffUserId: string,
): Promise<Conversation> {
  return api.post<Conversation>(endpoint(conversationId, "/assign"), { targetStaffUserId })
}

export function releaseConversation(conversationId: string): Promise<Conversation> {
  return api.post<Conversation>(endpoint(conversationId, "/release"))
}

export function closeConversation(conversationId: string): Promise<Conversation> {
  return api.post<Conversation>(endpoint(conversationId, "/close"))
}

export function markConversationRead(
  conversationId: string,
  payload: MarkConversationReadPayload = {},
): Promise<Conversation> {
  return api.post<Conversation>(endpoint(conversationId, "/read"), payload)
}

export function isConversationClaimConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "status" in error && error.status === 409)
}
