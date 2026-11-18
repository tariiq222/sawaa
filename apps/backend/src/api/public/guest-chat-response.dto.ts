import { ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  ConversationStatus,
  MessageSenderType,
} from '@prisma/client';

/**
 * Swagger response shapes for the unauthenticated guest chat routes:
 *
 *   POST /public/chat/conversations
 *   GET  /public/chat/conversations/current
 *   GET  /public/chat/conversations/{conversationId}/messages
 *   POST /public/chat/conversations/{conversationId}/messages
 *   POST /public/chat/conversations/{conversationId}/handoff
 *
 * Documentation only. The runtime payloads are produced by
 * `toChatConversationResponse` / `toChatMessageResponse` in
 * `modules/comms/chat`; nothing here is instantiated and no interceptor
 * rewrites a body. Guest access still travels only in the HttpOnly cookie —
 * no token, hash, or contact field may ever be documented on these schemas.
 */

const CONVERSATION_EXAMPLE = '00000000-4000-4000-a000-000000000001';
const MESSAGE_EXAMPLE = '00000000-4000-4000-a000-000000000002';
const OPERATION_EXAMPLE = '9f1c2f34-4a5b-4c6d-8e7f-001122334455';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** Conversation projection returned by `toChatConversationResponse`. */
export class PublicGuestChatConversationDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation identifier', example: CONVERSATION_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Always null for an unclaimed guest conversation', example: null })
  clientId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Practitioner the conversation is tied to, or null', example: null })
  employeeId!: string | null;

  @ApiProperty({ description: 'Whether the administrative assistant handles the conversation', example: true })
  isAiChat!: boolean;

  @ApiProperty({ enum: ConversationStatus, description: 'Conversation lifecycle status', example: 'AI_ACTIVE' })
  status!: ConversationStatus;

  @ApiProperty({ description: 'Conversation language code', example: 'ar' })
  language!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/**
 * `metadata` flag emitted when the assistant offers a human hand-off.
 * The exact runtime shape is `PublicChatHandoffMetadata`.
 */
export class PublicGuestChatHandoffMetadataDto {
  @ApiProperty({ enum: ['OFFER_HANDOFF'], description: 'Metadata discriminator', example: 'OFFER_HANDOFF' })
  action!: 'OFFER_HANDOFF';

  @ApiProperty({
    enum: ['OUT_OF_SCOPE', 'USER_REQUESTED', 'LIMIT_REACHED'],
    description: 'Why the assistant offered a hand-off',
    example: 'USER_REQUESTED',
  })
  reason!: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED';
}

/**
 * `metadata` flag emitted on an inbound message whose assistant reply failed
 * retryably. The exact runtime shape is `PublicChatAssistantRecoveryMetadata`.
 */
export class PublicGuestChatAssistantRecoveryMetadataDto {
  @ApiProperty({ enum: ['ASSISTANT_RECOVERY'], description: 'Metadata discriminator', example: 'ASSISTANT_RECOVERY' })
  action!: 'ASSISTANT_RECOVERY';

  @ApiProperty({ description: 'Whether the guest may retry the assistant reply', example: true })
  canRetry!: boolean;
}

/**
 * Sanitized chat operation card. The exact runtime shape is
 * `PublicChatOperation` — `summary` is a whitelisted, size-limited JSON object.
 */
export class PublicGuestChatOperationDto {
  @ApiProperty({ description: 'Operation identifier', example: OPERATION_EXAMPLE })
  id!: string;

  @ApiProperty({ enum: ChatOperationType, description: 'Operation type', example: 'CREATE_BOOKING' })
  type!: ChatOperationType;

  @ApiProperty({ enum: ChatOperationStatus, description: 'Operation lifecycle status', example: 'AWAITING_CONFIRMATION' })
  status!: ChatOperationStatus;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Optimistic concurrency version', example: 0 })
  version!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Confirmations required before execution', example: 1 })
  requiredConfirmations!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Confirmations collected so far', example: 0 })
  confirmationCount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Operation expiry instant', example: ISO_EXAMPLE })
  expiresAt!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking created or affected by the operation, or null', example: null })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Machine-readable failure code, or null', example: null })
  errorCode!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Whitelisted display summary (arbitrary JSON values, size-limited by the mapper)',
    example: { action: 'CREATE_BOOKING', serviceName: 'جلسة استشارة فردية' },
  })
  summary!: Record<string, unknown>;
}

/** `metadata` card emitted for an `ACTION_CARD` message. */
export class PublicGuestChatOperationCardMetadataDto {
  @ApiProperty({ enum: ['CHAT_OPERATION'], description: 'Metadata discriminator', example: 'CHAT_OPERATION' })
  action!: 'CHAT_OPERATION';

  @ApiProperty({ type: PublicGuestChatOperationDto, description: 'Sanitized operation the card renders' })
  operation!: PublicGuestChatOperationDto;
}

/**
 * `metadata` emitted for an `OPERATION_RESULT` message. `outcome` is documented
 * as an enum because the mapper only forwards these six values; the inferred
 * handler type widens it to `string`, and this DTO keeps that exact type.
 */
export class PublicGuestChatOperationResultMetadataDto {
  @ApiProperty({ description: 'Executed operation identifier', example: OPERATION_EXAMPLE })
  operationId!: string;

  @ApiProperty({ enum: ChatOperationType, description: 'Operation type', example: 'CREATE_BOOKING' })
  type!: ChatOperationType;

  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED', 'DECLINED'], description: 'Terminal operation status', example: 'SUCCEEDED' })
  status!: 'SUCCEEDED' | 'FAILED' | 'DECLINED';

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Booking created or affected by the operation, or null', example: '00000000-4000-4000-a000-000000000009' })
  bookingId?: string | null;

  @ApiPropertyOptional({
    enum: [
      'BOOKING_CREATED',
      'BOOKING_RESCHEDULED',
      'BOOKING_CANCELLED',
      'CANCELLATION_REQUESTED',
      'OPERATION_FAILED',
      'APPOINTMENTS_LISTED',
    ],
    description: 'Operation outcome forwarded by the mapper',
    example: 'BOOKING_CREATED',
  })
  outcome?: string;

  @ApiPropertyOptional({ description: 'Present and true only when booking synchronisation is still pending', example: true })
  syncPending?: boolean;
}

/** Message projection returned by `toChatMessageResponse`. */
export class PublicGuestChatMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Message identifier', example: MESSAGE_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Conversation the message belongs to', example: CONVERSATION_EXAMPLE })
  conversationId!: string;

  @ApiProperty({ enum: MessageSenderType, description: 'Sender category', example: 'VISITOR' })
  senderType!: MessageSenderType;

  @ApiProperty({ description: 'Message body', example: 'مرحباً، أحتاج إلى مساعدة.' })
  body!: string;

  @ApiProperty({ enum: ChatMessageKind, description: 'Message kind', example: 'TEXT' })
  kind!: ChatMessageKind;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client-generated idempotency identifier, or null', example: '00000000-4000-4000-a000-000000000005' })
  clientMessageId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Message creation instant', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Public metadata variant; omitted when the mapper has nothing safe to expose',
    oneOf: [
      { $ref: getSchemaPath(PublicGuestChatHandoffMetadataDto) },
      { $ref: getSchemaPath(PublicGuestChatAssistantRecoveryMetadataDto) },
      { $ref: getSchemaPath(PublicGuestChatOperationCardMetadataDto) },
      { $ref: getSchemaPath(PublicGuestChatOperationResultMetadataDto) },
    ],
  })
  metadata?:
    | PublicGuestChatHandoffMetadataDto
    | PublicGuestChatAssistantRecoveryMetadataDto
    | PublicGuestChatOperationCardMetadataDto
    | PublicGuestChatOperationResultMetadataDto;
}

/** Keyset pagination meta for the guest message list. */
export class PublicGuestChatMessageCursorMetaDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, description: 'Page size applied to the response', example: 20 })
  limit!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Cursor for the next page, or null when exhausted', example: MESSAGE_EXAMPLE })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether another page exists', example: false })
  hasMore!: boolean;
}

/** `GET /public/chat/conversations/{conversationId}/messages` response. */
export class PublicGuestChatMessagePageDto {
  @ApiProperty({ type: [PublicGuestChatMessageDto], description: 'Messages on the requested page (newest first)' })
  data!: PublicGuestChatMessageDto[];

  @ApiProperty({ type: PublicGuestChatMessageCursorMetaDto, description: 'Keyset pagination metadata' })
  meta!: PublicGuestChatMessageCursorMetaDto;
}
