import {
  acknowledgeChatOperation,
  claimGuestChatConversation,
  confirmChatOperation,
  createGuestChatConversation,
  declineChatOperation,
  getCurrentClientChatConversation,
  getCurrentGuestChatConversation,
  listClientChatConversations,
  listClientChatMessages,
  listGuestChatMessages,
  requestClientChatHandoff,
  requestGuestChatHandoff,
  retryClientChatMessage,
  retryGuestChatMessage,
  sendClientChatMessage,
  sendGuestChatMessage,
  setChatBaseUrl,
} from '@sawaa/api-client'
import type {
  ChatConversationDetail,
  ClientChatConversationPage,
  ChatMessage,
  ChatMessagePage,
  ChatOperation,
  ClaimedChatConversation,
  CreateGuestChatConversationRequest,
  GuestChatHandoffRequest,
  ListChatMessagesQuery,
  ListClientChatConversationsQuery,
  SendChatMessageRequest,
} from '@sawaa/api-client'

import { getApiBase } from '@/lib/api-base'

let initialised = false

function ensureInitialised(): void {
  if (initialised) return
  setChatBaseUrl(getApiBase())
  initialised = true
}

export function createGuestChatConversationApi(
  payload: CreateGuestChatConversationRequest = {},
): Promise<ChatConversationDetail> {
  ensureInitialised()
  return createGuestChatConversation(payload)
}

export function getCurrentGuestChatConversationApi(): Promise<ChatConversationDetail> {
  ensureInitialised()
  return getCurrentGuestChatConversation()
}

export function getCurrentClientChatConversationApi(): Promise<ChatConversationDetail> {
  ensureInitialised()
  return getCurrentClientChatConversation()
}

export function listClientChatConversationsApi(
  query: ListClientChatConversationsQuery = {},
): Promise<ClientChatConversationPage> {
  ensureInitialised()
  return listClientChatConversations(query)
}

export function claimGuestChatConversationApi(
  conversationId: string,
): Promise<ClaimedChatConversation> {
  ensureInitialised()
  return claimGuestChatConversation(conversationId)
}

export function sendGuestChatMessageApi(
  conversationId: string,
  payload: SendChatMessageRequest,
): Promise<ChatMessage> {
  ensureInitialised()
  return sendGuestChatMessage(conversationId, payload)
}

export function sendClientChatMessageApi(
  conversationId: string,
  payload: SendChatMessageRequest,
): Promise<ChatMessage> {
  ensureInitialised()
  return sendClientChatMessage(conversationId, payload)
}

export function retryGuestChatMessageApi(conversationId: string, messageId: string): Promise<ChatMessage> {
  ensureInitialised()
  return retryGuestChatMessage(conversationId, messageId)
}

export function retryClientChatMessageApi(conversationId: string, messageId: string): Promise<ChatMessage> {
  ensureInitialised()
  return retryClientChatMessage(conversationId, messageId)
}

export function listGuestChatMessagesApi(
  conversationId: string,
  query: ListChatMessagesQuery = {},
): Promise<ChatMessagePage> {
  ensureInitialised()
  return listGuestChatMessages(conversationId, query)
}

export function listClientChatMessagesApi(
  conversationId: string,
  query: ListChatMessagesQuery = {},
): Promise<ChatMessagePage> {
  ensureInitialised()
  return listClientChatMessages(conversationId, query)
}

export function requestGuestChatHandoffApi(
  conversationId: string,
  payload: GuestChatHandoffRequest,
): Promise<ChatConversationDetail> {
  ensureInitialised()
  return requestGuestChatHandoff(conversationId, payload)
}

export function requestClientChatHandoffApi(
  conversationId: string,
): Promise<ChatConversationDetail> {
  ensureInitialised()
  return requestClientChatHandoff(conversationId)
}

export function acknowledgeChatOperationApi(
  operationId: string,
  expectedVersion: number,
): Promise<ChatOperation> {
  ensureInitialised()
  return acknowledgeChatOperation(operationId, expectedVersion)
}

export function confirmChatOperationApi(
  operationId: string,
  expectedVersion: number,
): Promise<ChatOperation> {
  ensureInitialised()
  return confirmChatOperation(operationId, expectedVersion)
}

export function declineChatOperationApi(
  operationId: string,
  expectedVersion: number,
): Promise<ChatOperation> {
  ensureInitialised()
  return declineChatOperation(operationId, expectedVersion)
}
