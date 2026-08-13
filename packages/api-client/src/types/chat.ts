export type ChatConversationStatus =
  | 'OPEN'
  | 'AI_ACTIVE'
  | 'WAITING_FOR_STAFF'
  | 'STAFF_ACTIVE'
  | 'CLOSED'

export type ChatSenderType =
  | 'CLIENT'
  | 'EMPLOYEE'
  | 'VISITOR'
  | 'AI'
  | 'STAFF'
  | 'SYSTEM'

export type ChatMessageKind =
  | 'TEXT'
  | 'ACTION_CARD'
  | 'OPERATION_RESULT'
  | 'SYSTEM_EVENT'

export type ChatOperationType =
  | 'LIST_OWN_APPOINTMENTS'
  | 'CREATE_BOOKING'
  | 'RESCHEDULE_BOOKING'
  | 'CANCEL_BOOKING'

export type ChatOperationStatus =
  | 'AWAITING_AUTH'
  | 'AWAITING_EXISTING_BOOKING_ACK'
  | 'AWAITING_CONFIRMATION'
  | 'EXECUTING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'DECLINED'
  | 'EXPIRED'

export interface ChatConversationSummary {
  id: string
  status: ChatConversationStatus
  language: string
  createdAt: string
  updatedAt: string
}

export interface ChatConversationDetail extends ChatConversationSummary {
  employeeId: string | null
  isAiChat: boolean
}

/** A safe, client-owned conversation history item. It deliberately omits identities and internal metadata. */
export interface ClientChatConversationSummary {
  id: string
  status: ChatConversationStatus
  createdAt: string
  updatedAt: string
  lastMessageAt: string | null
  lastMessage: {
    preview: string
    senderType: ChatSenderType
    kind: ChatMessageKind
  } | null
}

export interface ListClientChatConversationsQuery {
  cursor?: string
  limit?: number
}

export interface ClientChatConversationPage {
  data: ClientChatConversationSummary[]
  meta: ChatCursorMeta
}

export interface ChatOperationBookingSummary {
  action?: ChatOperationType | 'LOGIN_REQUIRED'
  scheduledAt?: string
  endsAt?: string
  oldScheduledAt?: string
  newScheduledAt?: string
  newEndsAt?: string
  durationMins?: number
  price?: number
  currency?: string
  serviceName?: string
  employeeName?: string
  branchName?: string
  deliveryType?: 'IN_PERSON' | 'ONLINE'
  status?: string
}

export interface ChatOperationSummary extends ChatOperationBookingSummary {
  action?: ChatOperationType | 'LOGIN_REQUIRED'
  intent?: ChatOperationType
  existingBooking?: ChatOperationBookingSummary
  proposedBooking?: ChatOperationBookingSummary
}

export interface ChatOperation {
  id: string
  type: ChatOperationType
  status: ChatOperationStatus
  version: number
  requiredConfirmations: number
  confirmationCount: number
  expiresAt: string
  bookingId: string | null
  errorCode: string | null
  summary: ChatOperationSummary
}

export interface ChatOperationCardMetadata {
  action: 'CHAT_OPERATION'
  operation: ChatOperation
}

export interface ChatHandoffOfferMetadata {
  action: 'OFFER_HANDOFF'
  reason: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED'
}

export interface ChatAssistantRecoveryMetadata {
  action: 'ASSISTANT_RECOVERY'
  canRetry: boolean
}

export interface ChatOperationResultMetadata {
  operationId: string
  type: ChatOperationType
  status: Extract<ChatOperationStatus, 'SUCCEEDED' | 'FAILED' | 'DECLINED'>
  bookingId?: string | null
  outcome?:
    | 'BOOKING_CREATED'
    | 'BOOKING_RESCHEDULED'
    | 'BOOKING_CANCELLED'
    | 'CANCELLATION_REQUESTED'
    | 'OPERATION_FAILED'
    | 'APPOINTMENTS_LISTED'
  syncPending?: true
}

interface ChatMessageBase {
  id: string
  conversationId: string
  senderType: ChatSenderType
  body: string
  clientMessageId: string | null
  createdAt: string
}

export interface ChatTextMessage extends ChatMessageBase {
  kind: 'TEXT'
  metadata?: ChatHandoffOfferMetadata | ChatAssistantRecoveryMetadata
}

export interface ChatActionCardMessage extends ChatMessageBase {
  kind: 'ACTION_CARD'
  metadata?: ChatOperationCardMetadata
}

export interface ChatOperationResultMessage extends ChatMessageBase {
  kind: 'OPERATION_RESULT'
  metadata?: ChatOperationResultMetadata
}

export interface ChatSystemEventMessage extends ChatMessageBase {
  kind: 'SYSTEM_EVENT'
}

export type ChatMessage =
  | ChatTextMessage
  | ChatActionCardMessage
  | ChatOperationResultMessage
  | ChatSystemEventMessage

export interface ChatCursorMeta {
  limit: number
  nextCursor: string | null
  hasMore: boolean
}

export interface ChatMessagePage {
  data: ChatMessage[]
  meta: ChatCursorMeta
}

export interface CreateGuestChatConversationRequest {
  guestName?: string
  guestPhone?: string
  language?: 'ar' | 'en'
}

export interface SendChatMessageRequest {
  body: string
  clientMessageId: string
}

export interface ListChatMessagesQuery {
  cursor?: string
  limit?: number
}

export interface GuestChatHandoffRequest {
  guestName: string
  guestPhone: string
}

export interface ClaimedChatConversation extends ChatConversationDetail {
  resumedOperations: ChatOperation[]
}
