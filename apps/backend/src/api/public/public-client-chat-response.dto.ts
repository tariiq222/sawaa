import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from '@nestjs/swagger';
import {
  ChatMessageKind,
  ChatOperationStatus,
  ChatOperationType,
  ConversationStatus,
  MessageSenderType,
} from '@prisma/client';

/**
 * Swagger response shapes for the authenticated client chat routes in
 * `src/api/public/my-chat.controller.ts`:
 *
 *   GET  /public/me/chat/conversations/current
 *   GET  /public/me/chat/conversations/{conversationId}/messages
 *   POST /public/me/chat/conversations/{conversationId}/messages
 *   POST /public/me/chat/conversations/{conversationId}/handoff
 *   POST /public/me/chat/operations/{operationId}/acknowledge
 *   POST /public/me/chat/operations/{operationId}/confirm
 *   POST /public/me/chat/operations/{operationId}/decline
 *
 * These are the SAME projections the `/client/chat` area documents
 * (`toChatConversationResponse`, `toChatMessageResponse`,
 * `toPublicChatOperation`, `ListChatMessagesResult`), re-declared under the
 * `PublicClientChat…` schema prefix so no global schema name is shared across
 * areas. The controller keeps its inferred return types; nothing under
 * `src/modules/**` imports this layer and no serializer rewrites a body. No
 * token, hash or guest-contact field may ever appear on these schemas — client
 * access travels only in the client session cookies.
 */

const CONVERSATION_EXAMPLE = '00000000-4000-4000-a000-000000000001';
const MESSAGE_EXAMPLE = '00000000-4000-4000-a000-000000000002';
const OPERATION_EXAMPLE = '9f1c2f34-4a5b-4c6d-8e7f-001122334455';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** Conversation projection returned by `toChatConversationResponse`. */
export class PublicClientChatConversationDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation identifier', example: CONVERSATION_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Owning client UUID (always the authenticated client here), or null', example: '00000000-4000-4000-a000-000000000003' })
  clientId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Assigned employee UUID, or null', example: null })
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

/** `metadata` flag emitted when the assistant offers a human hand-off. */
export class PublicClientChatHandoffMetadataDto {
  @ApiProperty({ enum: ['OFFER_HANDOFF'], description: 'Metadata discriminator', example: 'OFFER_HANDOFF' })
  action!: 'OFFER_HANDOFF';

  @ApiProperty({
    enum: ['OUT_OF_SCOPE', 'USER_REQUESTED', 'LIMIT_REACHED'],
    description: 'Why the assistant offered a hand-off',
    example: 'USER_REQUESTED',
  })
  reason!: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED';
}

/** `metadata` flag emitted on an inbound message whose assistant reply failed retryably. */
export class PublicClientChatAssistantRecoveryMetadataDto {
  @ApiProperty({ enum: ['ASSISTANT_RECOVERY'], description: 'Metadata discriminator', example: 'ASSISTANT_RECOVERY' })
  action!: 'ASSISTANT_RECOVERY';

  @ApiProperty({ description: 'Whether the client may retry the assistant reply', example: true })
  canRetry!: boolean;
}

/** Sanitized chat operation. `summary` is a whitelisted, size-limited JSON object. */
export class PublicClientChatOperationDto {
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
export class PublicClientChatOperationCardMetadataDto {
  @ApiProperty({ enum: ['CHAT_OPERATION'], description: 'Metadata discriminator', example: 'CHAT_OPERATION' })
  action!: 'CHAT_OPERATION';

  @ApiProperty({ type: PublicClientChatOperationDto, description: 'Sanitized operation the card renders' })
  operation!: PublicClientChatOperationDto;
}

/**
 * `metadata` emitted for an `OPERATION_RESULT` message. `status` is the three
 * terminal values; `bookingId`/`outcome` are omitted on a declined result.
 */
export class PublicClientChatOperationResultMetadataDto {
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
@ApiExtraModels(
  PublicClientChatHandoffMetadataDto,
  PublicClientChatAssistantRecoveryMetadataDto,
  PublicClientChatOperationCardMetadataDto,
  PublicClientChatOperationResultMetadataDto,
)
export class PublicClientChatMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Message identifier', example: MESSAGE_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Conversation the message belongs to', example: CONVERSATION_EXAMPLE })
  conversationId!: string;

  @ApiProperty({ enum: MessageSenderType, description: 'Sender category', example: 'CLIENT' })
  senderType!: MessageSenderType;

  @ApiProperty({ description: 'Message body', example: 'أرغب في تأكيد الموعد.' })
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
      { $ref: getSchemaPath(PublicClientChatHandoffMetadataDto) },
      { $ref: getSchemaPath(PublicClientChatAssistantRecoveryMetadataDto) },
      { $ref: getSchemaPath(PublicClientChatOperationCardMetadataDto) },
      { $ref: getSchemaPath(PublicClientChatOperationResultMetadataDto) },
    ],
  })
  metadata?:
    | PublicClientChatHandoffMetadataDto
    | PublicClientChatAssistantRecoveryMetadataDto
    | PublicClientChatOperationCardMetadataDto
    | PublicClientChatOperationResultMetadataDto;
}

/** Keyset pagination meta for the client message list. */
export class PublicClientChatMessageCursorMetaDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, description: 'Page size applied to the response', example: 20 })
  limit!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Cursor for the next page, or null when exhausted', example: MESSAGE_EXAMPLE })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether another page exists', example: false })
  hasMore!: boolean;
}

/** `GET /public/me/chat/conversations/{conversationId}/messages` response. */
export class PublicClientChatMessagePageDto {
  @ApiProperty({ type: [PublicClientChatMessageDto], description: 'Messages on the requested page (newest first)' })
  data!: PublicClientChatMessageDto[];

  @ApiProperty({ type: PublicClientChatMessageCursorMetaDto, description: 'Keyset pagination metadata' })
  meta!: PublicClientChatMessageCursorMetaDto;
}
