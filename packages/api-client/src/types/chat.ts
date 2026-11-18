import type { components, paths } from './generated/openapi'

type Schemas = components['schemas']
type GuestConversation = Schemas['PublicGuestChatConversationDto']
type ChatMessagesQuery = NonNullable<
  paths['/api/v1/public/chat/conversations/{conversationId}/messages']['get']['parameters']['query']
>

/** Conversation lifecycle (`ConversationStatus`). */
export type ChatConversationStatus = Schemas['ConversationStatus']

/** Who sent a message (`MessageSenderType`). */
export type ChatSenderType = Schemas['MessageSenderType']

/** Message kind discriminator (`ChatMessageKind`). */
export type ChatMessageKind = Schemas['ChatMessageKind']

/** Chat operation verb (`ChatOperationType`). */
export type ChatOperationType = Schemas['ChatOperationType']

/** Chat operation lifecycle (`ChatOperationStatus`). */
export type ChatOperationStatus = Schemas['ChatOperationStatus']

/**
 * Guest conversation summary (`PublicGuestChatConversationDto`), projected to
 * the keys this client exposes (drops `clientId`).
 */
export type ChatConversationSummary = Pick<
  GuestConversation,
  'id' | 'status' | 'language' | 'createdAt' | 'updatedAt'
>

/** Guest conversation detail = documented conversation + the two detail keys. */
export type ChatConversationDetail = ChatConversationSummary &
  Pick<GuestConversation, 'employeeId' | 'isAiChat'>

/** Safe detail of `GET /client/chat/conversations/{id}` (`ClientChatConversationDetailDto`). */
export type ClientChatConversationDetail = Schemas['ClientChatConversationDetailDto']

/** `GET /client/chat/conversations` row (`ClientChatConversationSummaryDto`). */
export type ClientChatConversationSummary = Schemas['ClientChatConversationSummaryDto']

/** Query of `GET /client/chat/conversations` (cursor + limit). */
export type ListClientChatConversationsQuery = Pick<
  NonNullable<paths['/api/v1/client/chat/conversations']['get']['parameters']['query']>,
  'cursor' | 'limit'
>

/** `GET /client/chat/conversations` page (`ListClientChatConversationsResponseDto`). */
export type ClientChatConversationPage = Schemas['ListClientChatConversationsResponseDto']

/**
 * Booking summary inside an operation. NOT derived: the documented
 * `ClientChatOperationDto.summary` is documented only as
 * `{[key: string]: unknown}`; the backend builds these keys dynamically, so
 * this projection stays hand-written.
 */
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

/** Local shaping of the opaque documented `summary` (see above). */
export interface ChatOperationSummary extends ChatOperationBookingSummary {
  action?: ChatOperationType | 'LOGIN_REQUIRED'
  intent?: ChatOperationType
  existingBooking?: ChatOperationBookingSummary
  proposedBooking?: ChatOperationBookingSummary
}

/**
 * Chat operation (`ClientChatOperationDto`), with the opaque documented
 * `summary` re-typed to the local projection above.
 */
export type ChatOperation = Omit<Schemas['ClientChatOperationDto'], 'summary'> & {
  summary: ChatOperationSummary
}

/** Action-card metadata (`ClientChatOperationCardMetadataDto`), `operation` re-typed. */
export type ChatOperationCardMetadata = Omit<
  Schemas['ClientChatOperationCardMetadataDto'],
  'operation'
> & { operation: ChatOperation }

/** Handoff metadata (`ClientChatHandoffMetadataDto`). */
export type ChatHandoffOfferMetadata = Schemas['ClientChatHandoffMetadataDto']

/** Assistant recovery metadata (`ClientChatAssistantRecoveryMetadataDto`). */
export type ChatAssistantRecoveryMetadata = Schemas['ClientChatAssistantRecoveryMetadataDto']

/**
 * Operation-result metadata (`ClientChatOperationResultMetadataDto`).
 * `syncPending` is deliberately narrowed to `true`: the documented boolean is
 * only ever set to `true` by the mapper (absent otherwise), and the old
 * exported contract pinned that.
 */
export type ChatOperationResultMetadata = Omit<
  Schemas['ClientChatOperationResultMetadataDto'],
  'syncPending'
> & { syncPending?: true }

type ChatMessageRow = Schemas['ClientChatMessageDto']

interface ChatMessageBase {
  id: ChatMessageRow['id']
  conversationId: ChatMessageRow['conversationId']
  senderType: ChatMessageRow['senderType']
  body: ChatMessageRow['body']
  clientMessageId: ChatMessageRow['clientMessageId']
  createdAt: ChatMessageRow['createdAt']
}

export interface ChatTextMessage extends ChatMessageBase {
  kind: Extract<ChatMessageKind, 'TEXT'>
  metadata?: ChatHandoffOfferMetadata | ChatAssistantRecoveryMetadata
}

export interface ChatActionCardMessage extends ChatMessageBase {
  kind: Extract<ChatMessageKind, 'ACTION_CARD'>
  metadata?: ChatOperationCardMetadata
}

export interface ChatOperationResultMessage extends ChatMessageBase {
  kind: Extract<ChatMessageKind, 'OPERATION_RESULT'>
  metadata?: ChatOperationResultMetadata
}

export interface ChatSystemEventMessage extends ChatMessageBase {
  kind: Extract<ChatMessageKind, 'SYSTEM_EVENT'>
}

export type ChatMessage =
  | ChatTextMessage
  | ChatActionCardMessage
  | ChatOperationResultMessage
  | ChatSystemEventMessage

/** Cursor meta (`ClientChatMessagePageMetaDto`). */
export type ChatCursorMeta = Schemas['ClientChatMessagePageMetaDto']

/** Message page (`ClientChatMessagePageDto`), `data` re-typed to the discriminated union. */
export type ChatMessagePage = Omit<Schemas['ClientChatMessagePageDto'], 'data'> & {
  data: ChatMessage[]
}

/** Request body of `POST /public/chat/conversations` (`CreateGuestConversationDto`). */
export type CreateGuestChatConversationRequest = Schemas['CreateGuestConversationDto']

/** Request body of `POST …/messages` (`SendChatMessageDto`). */
export type SendChatMessageRequest = Schemas['SendChatMessageDto']

/** Query of `GET …/messages` (cursor + limit). */
export type ListChatMessagesQuery = Pick<ChatMessagesQuery, 'cursor' | 'limit'>

/** Request body of `POST /public/chat/conversations/{id}/handoff` (`GuestRequestHandoffDto`). */
export type GuestChatHandoffRequest = Schemas['GuestRequestHandoffDto']

/**
 * 201 body of `POST /client/chat/conversations/{id}/claim`
 * (`ClaimGuestConversationResponseDto`), with `resumedOperations` re-typed.
 */
export type ClaimedChatConversation = Omit<
  Schemas['ClaimGuestConversationResponseDto'],
  'resumedOperations' | 'employeeId' | 'clientId'
> & {
  /**
   * Documented as optional (`ClaimGuestConversationResponseDto`), but a claim
   * is only issued for an existing conversation, so it is always present.
   * Kept required to preserve the legacy `ChatConversationDetail` shape.
   */
  employeeId: GuestConversation['employeeId']
  resumedOperations: ChatOperation[]
}
