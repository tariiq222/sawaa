import {
  acknowledgeChatOperation,
  claimGuestChatConversation,
  confirmChatOperation,
  createGuestChatConversation,
  declineChatOperation,
  getCurrentClientChatConversation,
  getClientChatConversation,
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
  ClientChatConversationDetail,
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

export interface ChatReadRequestOptions {
  signal?: AbortSignal;
}

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

export function getClientChatConversationApi(conversationId: string): Promise<ClientChatConversationDetail> {
  ensureInitialised()
  return getClientChatConversation(conversationId)
}

export function listClientChatConversationsApi(
  query: ListClientChatConversationsQuery = {},
  requestOptions?: ChatReadRequestOptions,
): Promise<ClientChatConversationPage> {
  ensureInitialised()
  return requestOptions
    ? listClientChatConversations(query, requestOptions)
    : listClientChatConversations(query)
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
  requestOptions?: ChatReadRequestOptions,
): Promise<ChatMessagePage> {
  ensureInitialised()
  return requestOptions
    ? listGuestChatMessages(conversationId, query, requestOptions)
    : listGuestChatMessages(conversationId, query)
}

export function listClientChatMessagesApi(
  conversationId: string,
  query: ListChatMessagesQuery = {},
  requestOptions?: ChatReadRequestOptions,
): Promise<ChatMessagePage> {
  ensureInitialised()
  return requestOptions
    ? listClientChatMessages(conversationId, query, requestOptions)
    : listClientChatMessages(conversationId, query)
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
