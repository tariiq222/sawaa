import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  ConversationStatus,
  MessageSenderType,
} from '@prisma/client';
import type { PublicChatMessageMetadata } from '../../../modules/comms/chat/messages/chat-message.mapper';

/**
 * Response shapes of the dashboard reception-chat endpoints
 * (`dashboard/conversations.controller.ts`).
 *
 * These classes only document what the handlers/mappers already return. They are
 * never instantiated and no interceptor rewrites the payload, so they cannot
 * change a response. `conversation-response.dto.spec.ts` asserts the inferred
 * handler/mapper outputs are exactly these DTOs.
 */

const CONVERSATION_EXAMPLE = '00000000-4000-4000-a000-000000000001';
const MESSAGE_EXAMPLE = '00000000-4000-4000-a000-000000000002';
const STAFF_EXAMPLE = '00000000-4000-4000-a000-000000000003';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/**
 * Safe hand-off projection built by `parseHandoffSummary` in
 * `modules/comms/chat/assistant/administrative-tools.service.ts`. Optional keys
 * are omitted entirely when the model did not supply them.
 */
export class ConversationHandoffSummaryDto {
  @ApiProperty({
    description: 'Staff-facing hand-off category',
    enum: ['USER_REQUESTED', 'COMPLAINT', 'FINANCIAL_EXCEPTION', 'UNAVAILABLE_APPOINTMENT', 'OTHER'],
    example: 'USER_REQUESTED',
  })
  category!: 'USER_REQUESTED' | 'COMPLAINT' | 'FINANCIAL_EXCEPTION' | 'UNAVAILABLE_APPOINTMENT' | 'OTHER';

  @ApiProperty({ description: 'Short summary of what the visitor asked for', example: 'العميل يطلب التحدث مع موظفة الاستقبال' })
  requestSummary!: string;

  @ApiProperty({ description: 'Outcome the visitor is looking for', example: 'تعديل موعد الجلسة القادمة' })
  desiredOutcome!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Service UUID mentioned in the hand-off, when provided', example: CONVERSATION_EXAMPLE })
  serviceId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Practitioner UUID mentioned in the hand-off, when provided', example: STAFF_EXAMPLE })
  practitionerId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Alternative options the visitor accepted, when provided',
    example: ['صباحاً', 'بعد العصر'],
  })
  acceptableAlternatives?: string[];
}

/**
 * `GET /dashboard/conversations` row, `GET /dashboard/conversations/:id`, and
 * the claim/assign/release/close responses (`toStaffConversationResponse`).
 * `customerContext` is deliberately not part of this projection; the mapper
 * replaces it with the safe `handoffSummary`.
 */
export class ConversationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation identifier', example: CONVERSATION_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Owning client UUID, or null for a guest conversation', example: null })
  clientId!: string | null;

  @ApiProperty({ description: 'Whether the conversation is handled by the administrative assistant', example: true })
  isAiChat!: boolean;

  @ApiProperty({ enum: ConversationStatus, description: 'Conversation lifecycle status', example: 'WAITING_FOR_STAFF' })
  status!: ConversationStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Guest display name, or null for a signed-in client', example: 'سارة' })
  guestName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Guest phone number, or null when not supplied', example: '+966501234567' })
  guestPhone!: string | null;

  @ApiProperty({ description: 'Conversation language code', example: 'ar' })
  language!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Dashboard user currently handling the conversation, or null', example: null })
  assignedStaffUserId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the visitor requested a human hand-off, or null', example: ISO_EXAMPLE })
  handoffRequestedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When a dashboard user claimed the conversation, or null', example: null })
  staffClaimedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the conversation was closed, or null', example: null })
  closedAt!: Date | null;

  @ApiProperty({ type: 'integer', description: 'Unread messages for staff', example: 2 })
  staffUnreadCount!: number;

  @ApiProperty({ type: 'integer', description: 'Unread messages for the visitor', example: 0 })
  clientUnreadCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Timestamp of the latest message, or null for an empty conversation', example: ISO_EXAMPLE })
  lastMessageAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation creation timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation update timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;

  @ApiProperty({ type: ConversationHandoffSummaryDto, nullable: true, description: 'Safe hand-off summary, or null when no hand-off was requested' })
  handoffSummary!: ConversationHandoffSummaryDto | null;
}

/** Safe operation card projection embedded in `ACTION_CARD` message metadata. */
export class ConversationPublicOperationDto {
  @ApiProperty({ description: 'Operation identifier', example: 'op-1' })
  id!: string;

  @ApiProperty({ enum: ChatOperationType, description: 'Operation type', example: 'CREATE_BOOKING' })
  type!: ChatOperationType;

  @ApiProperty({ enum: ChatOperationStatus, description: 'Operation lifecycle status', example: 'AWAITING_CONFIRMATION' })
  status!: ChatOperationStatus;

  @ApiProperty({ type: 'integer', description: 'Optimistic concurrency version', example: 1 })
  version!: number;

  @ApiProperty({ type: 'integer', description: 'Confirmations required before execution', example: 1 })
  requiredConfirmations!: number;

  @ApiProperty({ type: 'integer', description: 'Confirmations collected so far', example: 0 })
  confirmationCount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Operation expiry as an ISO 8601 timestamp', example: ISO_EXAMPLE })
  expiresAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Booking created by the operation, or null', example: null })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Failure code, or null when the operation has not failed', example: null })
  errorCode!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Sanitized display summary of the operation' })
  summary!: Record<string, unknown>;
}

/** `{ action: 'OFFER_HANDOFF' }` metadata emitted by the assistant. */
export class ConversationHandoffMessageMetadataDto {
  @ApiProperty({ description: 'Metadata discriminator', enum: ['OFFER_HANDOFF'], example: 'OFFER_HANDOFF' })
  action!: 'OFFER_HANDOFF';

  @ApiProperty({ description: 'Why the assistant offered a hand-off', enum: ['OUT_OF_SCOPE', 'USER_REQUESTED', 'LIMIT_REACHED'], example: 'USER_REQUESTED' })
  reason!: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED';
}

/** `{ action: 'ASSISTANT_RECOVERY' }` metadata attached to retryable visitor messages. */
export class ConversationAssistantRecoveryMetadataDto {
  @ApiProperty({ description: 'Metadata discriminator', enum: ['ASSISTANT_RECOVERY'], example: 'ASSISTANT_RECOVERY' })
  action!: 'ASSISTANT_RECOVERY';

  @ApiProperty({ description: 'Whether the visitor may retry the failed message', example: true })
  canRetry!: boolean;
}

/** `{ action: 'CHAT_OPERATION' }` metadata carrying a public operation card. */
export class ConversationOperationMetadataDto {
  @ApiProperty({ description: 'Metadata discriminator', enum: ['CHAT_OPERATION'], example: 'CHAT_OPERATION' })
  action!: 'CHAT_OPERATION';

  @ApiProperty({ type: ConversationPublicOperationDto, description: 'Public operation card' })
  operation!: ConversationPublicOperationDto;
}

/** Metadata for an `OPERATION_RESULT` message. */
export class ConversationOperationResultMetadataDto {
  @ApiProperty({ description: 'Operation identifier', example: 'op-1' })
  operationId!: string;

  @ApiProperty({ enum: ChatOperationType, description: 'Operation type', example: 'CREATE_BOOKING' })
  type!: ChatOperationType;

  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED', 'DECLINED'], description: 'Terminal operation status', example: 'SUCCEEDED' })
  status!: 'SUCCEEDED' | 'FAILED' | 'DECLINED';

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Booking referenced by the result; omitted for declined operations' })
  bookingId?: string | null;

  @ApiPropertyOptional({ description: 'Result outcome label; omitted for declined operations', example: 'BOOKING_CREATED' })
  outcome?: string;

  @ApiPropertyOptional({ description: 'Set to true only when the booking still needs provider sync', example: true })
  syncPending?: boolean;
}

/**
 * The safe metadata vocabulary is owned by
 * `modules/comms/chat/messages/chat-message.mapper.ts`
 * (`toPublicMetadata`). Importing the type (type-only) keeps this DTO exactly
 * as wide as the mapper output instead of re-declaring a near-copy.
 */
export type ConversationMessageMetadata = PublicChatMessageMetadata;

/**
 * One message row from `GET /dashboard/conversations/:conversationId/messages`
 * and the reply response (`toChatMessageResponse`). `metadata` is omitted when
 * the stored JSON is not one of the safe public shapes.
 */
@ApiExtraModels(
  ConversationHandoffMessageMetadataDto,
  ConversationAssistantRecoveryMetadataDto,
  ConversationOperationMetadataDto,
  ConversationOperationResultMetadataDto,
)
export class ConversationMessageResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Message identifier', example: MESSAGE_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Conversation the message belongs to', example: CONVERSATION_EXAMPLE })
  conversationId!: string;

  @ApiProperty({ enum: MessageSenderType, description: 'Message author type', example: 'STAFF' })
  senderType!: MessageSenderType;

  @ApiProperty({ description: 'Message body', example: 'مرحباً، كيف أستطيع مساعدتك؟' })
  body!: string;

  @ApiProperty({ enum: ChatMessageKind, description: 'Message kind', example: 'TEXT' })
  kind!: ChatMessageKind;

  @ApiProperty({ type: String, nullable: true, description: 'Client-generated idempotency identifier, or null', example: 'staff-1' })
  clientMessageId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Message creation timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Safe public metadata; omitted when the stored metadata is missing or unsafe',
    oneOf: [
      { $ref: getSchemaPath(ConversationHandoffMessageMetadataDto) },
      { $ref: getSchemaPath(ConversationAssistantRecoveryMetadataDto) },
      { $ref: getSchemaPath(ConversationOperationMetadataDto) },
      { $ref: getSchemaPath(ConversationOperationResultMetadataDto) },
    ],
  })
  metadata?: ConversationMessageMetadata;
}

/** Keyset pagination metadata shared by the inbox and message lists. */
export class ConversationCursorMetaDto {
  @ApiProperty({ type: 'integer', description: 'Page size used for the response', example: 20 })
  limit!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Cursor for the next page, or null when exhausted', example: null })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether another page exists', example: false })
  hasMore!: boolean;
}

/** `GET /dashboard/conversations` response. */
export class ConversationInboxResponseDto {
  @ApiProperty({ type: [ConversationResponseDto], description: 'Conversations on the requested page' })
  data!: ConversationResponseDto[];

  @ApiProperty({ type: ConversationCursorMetaDto, description: 'Keyset pagination metadata' })
  meta!: ConversationCursorMetaDto;
}

/** `GET /dashboard/conversations/:conversationId/messages` response. */
export class ConversationMessagesResponseDto {
  @ApiProperty({ type: [ConversationMessageResponseDto], description: 'Messages on the requested page' })
  data!: ConversationMessageResponseDto[];

  @ApiProperty({ type: ConversationCursorMetaDto, description: 'Keyset pagination metadata' })
  meta!: ConversationCursorMetaDto;
}

/** `POST /dashboard/conversations/:conversationId/read` response. */
export class ConversationReadResponseDto {
  @ApiProperty({ type: 'integer', description: 'How many messages were marked read by this call', example: 3 })
  markedReadCount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Timestamp written to the marked messages', example: ISO_EXAMPLE })
  readAt!: Date;
}
