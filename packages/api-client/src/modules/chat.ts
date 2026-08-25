import { apiRequest, ensureCsrfToken, setApiRequestBaseUrl } from '../client'
import type {
  ChatActionCardMessage,
  ChatConversationDetail,
  ClientChatConversationDetail,
  ClientChatConversationPage,
  ChatHandoffOfferMetadata,
  ChatAssistantRecoveryMetadata,
  ChatMessage,
  ChatMessagePage,
  ChatOperation,
  ChatOperationBookingSummary,
  ChatOperationResultMessage,
  ChatOperationSummary,
  ClaimedChatConversation,
  CreateGuestChatConversationRequest,
  GuestChatHandoffRequest,
  ListChatMessagesQuery,
  ListClientChatConversationsQuery,
  SendChatMessageRequest,
} from '../types/chat'

export function setChatBaseUrl(url: string): void {
  setApiRequestBaseUrl(url)
}

export async function createGuestChatConversation(
  payload: CreateGuestChatConversationRequest = {},
): Promise<ChatConversationDetail> {
  const result = await chatMutation<ChatConversationDetail>('/public/chat/conversations', payload)
  return toConversationDetail(result)
}

export async function getCurrentGuestChatConversation(): Promise<ChatConversationDetail> {
  const result = await chatRequest<ChatConversationDetail>('/public/chat/conversations/current')
  return toConversationDetail(result)
}

export async function getCurrentClientChatConversation(): Promise<ChatConversationDetail> {
  const result = await chatRequest<ChatConversationDetail>('/public/me/chat/conversations/current')
  return toConversationDetail(result)
}

export async function getClientChatConversation(conversationId: string): Promise<ClientChatConversationDetail> {
  const result = await chatRequest<ClientChatConversationDetail>(
    `/public/me/chat/conversations/${encodeURIComponent(conversationId)}`,
  )
  return {
    id: result.id,
    isAiChat: result.isAiChat,
    status: result.status,
    language: result.language,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }
}

export async function listClientChatConversations(
  query: ListClientChatConversationsQuery = {},
  requestOptions?: Pick<RequestInit, 'signal'>,
): Promise<ClientChatConversationPage> {
  const result = await chatRequest<ClientChatConversationPage>(
    `/public/me/chat/conversations${messageQuery(query)}`,
    requestOptions,
  )
  return toClientChatConversationPage(result)
}

export async function claimGuestChatConversation(
  conversationId: string,
): Promise<ClaimedChatConversation> {
  const result = await chatMutation<ClaimedChatConversation>(
    `/public/me/chat/conversations/${encodeURIComponent(conversationId)}/claim`,
    {},
  )
  return {
    ...toConversationDetail(result),
    resumedOperations: result.resumedOperations.map(toChatOperation),
  }
}

export async function sendGuestChatMessage(
  conversationId: string,
  payload: SendChatMessageRequest,
): Promise<ChatMessage> {
  const result = await chatMutation<ChatMessage>(
    `/public/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    payload,
  )
  return toChatMessage(result)
}

export async function sendClientChatMessage(
  conversationId: string,
  payload: SendChatMessageRequest,
): Promise<ChatMessage> {
  const result = await chatMutation<ChatMessage>(
    `/public/me/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    payload,
  )
  return toChatMessage(result)
}

export async function retryGuestChatMessage(
  conversationId: string,
  messageId: string,
): Promise<ChatMessage> {
  const result = await chatMutation<ChatMessage>(
    `/public/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/retry`,
    {},
  )
  return toChatMessage(result)
}

export async function retryClientChatMessage(
  conversationId: string,
  messageId: string,
): Promise<ChatMessage> {
  const result = await chatMutation<ChatMessage>(
    `/public/me/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/retry`,
    {},
  )
  return toChatMessage(result)
}

export async function listGuestChatMessages(
  conversationId: string,
  query: ListChatMessagesQuery = {},
  requestOptions?: Pick<RequestInit, 'signal'>,
): Promise<ChatMessagePage> {
  const result = await chatRequest<ChatMessagePage>(
    `/public/chat/conversations/${encodeURIComponent(conversationId)}/messages${messageQuery(query)}`,
    requestOptions,
  )
  return toChatMessagePage(result)
}

export async function listClientChatMessages(
  conversationId: string,
  query: ListChatMessagesQuery = {},
  requestOptions?: Pick<RequestInit, 'signal'>,
): Promise<ChatMessagePage> {
  const result = await chatRequest<ChatMessagePage>(
    `/public/me/chat/conversations/${encodeURIComponent(conversationId)}/messages${messageQuery(query)}`,
    requestOptions,
  )
  return toChatMessagePage(result)
}

export async function requestGuestChatHandoff(
  conversationId: string,
  payload: GuestChatHandoffRequest,
): Promise<ChatConversationDetail> {
  const result = await chatMutation<ChatConversationDetail>(
    `/public/chat/conversations/${encodeURIComponent(conversationId)}/handoff`,
    payload,
  )
  return toConversationDetail(result)
}

export async function requestClientChatHandoff(
  conversationId: string,
): Promise<ChatConversationDetail> {
  const result = await chatMutation<ChatConversationDetail>(
    `/public/me/chat/conversations/${encodeURIComponent(conversationId)}/handoff`,
    {},
  )
  return toConversationDetail(result)
}

export function acknowledgeChatOperation(
  operationId: string,
  expectedVersion: number,
): Promise<ChatOperation> {
  return mutateOperation(operationId, 'acknowledge', expectedVersion)
}

export function confirmChatOperation(
  operationId: string,
  expectedVersion: number,
): Promise<ChatOperation> {
  return mutateOperation(operationId, 'confirm', expectedVersion)
}

export function declineChatOperation(
  operationId: string,
  expectedVersion: number,
): Promise<ChatOperation> {
  return mutateOperation(operationId, 'decline', expectedVersion)
}

async function mutateOperation(
  operationId: string,
  action: 'acknowledge' | 'confirm' | 'decline',
  expectedVersion: number,
): Promise<ChatOperation> {
  const result = await chatMutation<ChatOperation>(
    `/public/me/chat/operations/${encodeURIComponent(operationId)}/${action}`,
    { expectedVersion },
  )
  return toChatOperation(result)
}

function chatRequest<T>(path: string, requestOptions: Pick<RequestInit, 'signal'> = {}): Promise<T> {
  // Chat message state changes asynchronously after the inbound message is
  // persisted (for example when the assistant becomes retryable). Browsers
  // are otherwise allowed to validate a cached GET with the old ETag and
  // return 304, leaving the widget unaware of the new public recovery card.
  return apiRequest<T>(path, { ...requestOptions, cache: 'no-store', credentials: 'include' })
}

async function chatMutation<T>(path: string, body: object): Promise<T> {
  const token = await ensureCsrfToken()
  return apiRequest<T>(path, {
    method: 'POST',
    credentials: 'include',
    ...(token ? { headers: { 'X-CSRF-Token': token } } : {}),
    body: JSON.stringify(body),
  })
}

function messageQuery(query: ListChatMessagesQuery): string {
  const params = new URLSearchParams()
  if (query.cursor) params.set('cursor', query.cursor)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  const value = params.toString()
  return value ? `?${value}` : ''
}

function toConversationDetail(value: ChatConversationDetail): ChatConversationDetail {
  return {
    id: value.id,
    employeeId: value.employeeId,
    isAiChat: value.isAiChat,
    status: value.status,
    language: value.language,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function toChatMessagePage(value: ChatMessagePage): ChatMessagePage {
  return {
    data: value.data.map(toChatMessage),
    meta: {
      limit: value.meta.limit,
      nextCursor: value.meta.nextCursor,
      hasMore: value.meta.hasMore,
    },
  }
}

function toClientChatConversationPage(value: ClientChatConversationPage): ClientChatConversationPage {
  return {
    data: value.data.map((conversation) => ({
      id: conversation.id,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      lastMessage: conversation.lastMessage
        ? {
          preview: conversation.lastMessage.preview,
          senderType: conversation.lastMessage.senderType,
          kind: conversation.lastMessage.kind,
        }
        : null,
    })),
    meta: {
      limit: value.meta.limit,
      nextCursor: value.meta.nextCursor,
      hasMore: value.meta.hasMore,
    },
  }
}

function toChatMessage(value: ChatMessage): ChatMessage {
  const base = {
    id: value.id,
    conversationId: value.conversationId,
    senderType: value.senderType,
    body: value.body,
    clientMessageId: value.clientMessageId,
    createdAt: value.createdAt,
  }

  if (value.kind === 'ACTION_CARD') {
    const metadata = toActionCardMetadata(value.metadata)
    return { ...base, kind: value.kind, ...(metadata ? { metadata } : {}) }
  }
  if (value.kind === 'OPERATION_RESULT') {
    const metadata = toOperationResultMetadata(value.metadata)
    return { ...base, kind: value.kind, ...(metadata ? { metadata } : {}) }
  }
  if (value.kind === 'TEXT') {
    const metadata = toHandoffMetadata(value.metadata)
    return { ...base, kind: value.kind, ...(metadata ? { metadata } : {}) }
  }
  return { ...base, kind: 'SYSTEM_EVENT' }
}

function toActionCardMetadata(
  value: ChatActionCardMessage['metadata'],
): ChatActionCardMessage['metadata'] {
  if (!value || value.action !== 'CHAT_OPERATION') return undefined
  return { action: 'CHAT_OPERATION', operation: toChatOperation(value.operation) }
}

function toHandoffMetadata(
  value: ChatHandoffOfferMetadata | ChatAssistantRecoveryMetadata | undefined,
): ChatHandoffOfferMetadata | ChatAssistantRecoveryMetadata | undefined {
  if (!value) return undefined
  if (value.action === 'OFFER_HANDOFF') return { action: 'OFFER_HANDOFF', reason: value.reason }
  if (value.action === 'ASSISTANT_RECOVERY') {
    return { action: 'ASSISTANT_RECOVERY', canRetry: value.canRetry === true }
  }
  return undefined
}

function toOperationResultMetadata(
  value: ChatOperationResultMessage['metadata'],
): ChatOperationResultMessage['metadata'] {
  if (!value) return undefined
  return {
    operationId: value.operationId,
    type: value.type,
    status: value.status,
    ...(value.bookingId !== undefined ? { bookingId: value.bookingId } : {}),
    ...(value.outcome !== undefined ? { outcome: value.outcome } : {}),
    ...(value.syncPending === true ? { syncPending: true } : {}),
  }
}

function toChatOperation(value: ChatOperation): ChatOperation {
  return {
    id: value.id,
    type: value.type,
    status: value.status,
    version: value.version,
    requiredConfirmations: value.requiredConfirmations,
    confirmationCount: value.confirmationCount,
    expiresAt: value.expiresAt,
    bookingId: value.bookingId,
    errorCode: value.errorCode,
    summary: toOperationSummary(value.summary),
  }
}

function toOperationSummary(value: ChatOperationSummary): ChatOperationSummary {
  return {
    ...toBookingSummary(value),
    ...(value.intent !== undefined ? { intent: value.intent } : {}),
    ...(value.existingBooking !== undefined
      ? { existingBooking: toBookingSummary(value.existingBooking) }
      : {}),
    ...(value.proposedBooking !== undefined
      ? { proposedBooking: toBookingSummary(value.proposedBooking) }
      : {}),
  }
}

function toBookingSummary(value: ChatOperationBookingSummary): ChatOperationBookingSummary {
  return pickDefined({
    action: value.action,
    scheduledAt: value.scheduledAt,
    endsAt: value.endsAt,
    oldScheduledAt: value.oldScheduledAt,
    newScheduledAt: value.newScheduledAt,
    newEndsAt: value.newEndsAt,
    durationMins: value.durationMins,
    price: value.price,
    currency: value.currency,
    serviceName: value.serviceName,
    employeeName: value.employeeName,
    branchName: value.branchName,
    deliveryType: value.deliveryType,
    status: value.status,
  })
}

function pickDefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>
}
