import { ApiExtraModels, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageKind, ChatOperationStatus, ChatOperationType, ConversationStatus, MessageSenderType } from '@prisma/client';

/**
 * Swagger response shapes for the authenticated CLIENT chat routes under
 * `src/api/client/chat.controller.ts`.
 *
 * Every projection here already narrows the domain row:
 *   - `toChatConversationResponse` (id, clientId, employeeId, isAiChat,
 *     status, language, createdAt, updatedAt),
 *   - `toChatMessageResponse` (+ the sanitized public metadata union),
 *   - `toPublicChatOperation` (id, type, status, version, confirmations,
 *     expiresAt, bookingId, errorCode, sanitized summary).
 *
 * Documentation only: the handlers keep inferred returns and no file under
 * `src/modules/**` imports this layer. `client-response.dto.spec.ts` pins the
 * classes to those projections.
 */

/** `GET /client/chat/conversations/current` and `POST …/handoff`. */
export class ClientChatConversationDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation UUID', example: '00000000-0000-4000-a000-000000000001' })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Owning client UUID, or null for a guest conversation', example: '00000000-0000-4000-a000-000000000002' })
  clientId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Assigned employee UUID, or null', example: null })
  employeeId!: string | null;

  @ApiProperty({ description: 'Whether the assistant answers this conversation', example: true })
  isAiChat!: boolean;

  @ApiProperty({ enum: ConversationStatus, enumName: 'ConversationStatus', description: 'Conversation status', example: 'AI_ACTIVE' })
  status!: ConversationStatus;

  @ApiProperty({ description: 'Conversation language code', example: 'ar' })
  language!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant', example: '2026-05-20T09:05:00.000Z' })
  updatedAt!: Date;
}

/** One chat operation as exposed to clients by `toPublicChatOperation`. */
export class ClientChatOperationDto {
  @ApiProperty({ description: 'Operation UUID', example: '00000000-0000-4000-a000-000000000010' })
  id!: string;

  @ApiProperty({ enum: ChatOperationType, enumName: 'ChatOperationType', description: 'Operation type', example: 'CREATE_BOOKING' })
  type!: ChatOperationType;

  @ApiProperty({ enum: ChatOperationStatus, enumName: 'ChatOperationStatus', description: 'Operation status', example: 'AWAITING_CONFIRMATION' })
  status!: ChatOperationStatus;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Optimistic-lock version; send it back as `expectedVersion`', example: 1 })
  version!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Confirmation steps required before execution', example: 1 })
  requiredConfirmations!: number;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Confirmation steps already recorded', example: 0 })
  confirmationCount!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'Expiry instant (ISO 8601)', example: '2026-05-20T10:00:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Booking UUID touched by the operation, or null', example: null })
  bookingId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Machine-readable failure code, or null', example: null })
  errorCode!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Sanitized display summary. The mapper keeps only these keys (nested allow-list for `existingBooking`/`proposedBooking`): ' +
      'action, intent, existingBooking, proposedBooking, scheduledAt, endsAt, oldScheduledAt, newScheduledAt, newEndsAt, ' +
      'durationMins, price, currency, serviceName, employeeName, branchName, deliveryType, status. Dates are ISO strings, ' +
      '`durationMins`/`price` are finite non-negative numbers, and unsafe markup/URLs are dropped.',
    example: { action: 'CREATE_BOOKING', scheduledAt: '2026-06-02T09:00:00.000Z', serviceName: 'Family consultation', currency: 'SAR' },
  })
  summary!: Record<string, unknown>;
}

/** `ACTION_CARD` metadata carrying the prepared operation. */
export class ClientChatOperationCardMetadataDto {
  @ApiProperty({ enum: ['CHAT_OPERATION'], description: 'Metadata discriminant', example: 'CHAT_OPERATION' })
  action!: 'CHAT_OPERATION';

  @ApiProperty({ type: ClientChatOperationDto, description: 'Prepared operation shown on the card' })
  operation!: ClientChatOperationDto;
}

/** `OFFER_HANDOFF` metadata. */
export class ClientChatHandoffMetadataDto {
  @ApiProperty({ enum: ['OFFER_HANDOFF'], description: 'Metadata discriminant', example: 'OFFER_HANDOFF' })
  action!: 'OFFER_HANDOFF';

  @ApiProperty({ enum: ['OUT_OF_SCOPE', 'USER_REQUESTED', 'LIMIT_REACHED'], description: 'Why reception handoff was offered', example: 'USER_REQUESTED' })
  reason!: 'OUT_OF_SCOPE' | 'USER_REQUESTED' | 'LIMIT_REACHED';
}

/** `ASSISTANT_RECOVERY` metadata on a retryable inbound message. */
export class ClientChatAssistantRecoveryMetadataDto {
  @ApiProperty({ enum: ['ASSISTANT_RECOVERY'], description: 'Metadata discriminant', example: 'ASSISTANT_RECOVERY' })
  action!: 'ASSISTANT_RECOVERY';

  @ApiProperty({ description: 'Whether the client may retry the assistant reply', example: true })
  canRetry!: boolean;
}

/** `OPERATION_RESULT` metadata produced after confirm/decline. */
export class ClientChatOperationResultMetadataDto {
  @ApiProperty({ description: 'Operation UUID (safe id charset)', example: '00000000-0000-4000-a000-000000000010' })
  operationId!: string;

  @ApiProperty({ enum: ChatOperationType, enumName: 'ChatOperationType', description: 'Operation type', example: 'CREATE_BOOKING' })
  type!: ChatOperationType;

  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED', 'DECLINED'], description: 'Terminal operation status', example: 'SUCCEEDED' })
  status!: Extract<ChatOperationStatus, 'SUCCEEDED' | 'FAILED' | 'DECLINED'>;

  @ApiPropertyOptional({ type: String, nullable: true, description: 'Booking UUID created/rescheduled by the operation, or null. Absent on a declined result.', example: '00000000-0000-4000-a000-000000000002' })
  bookingId?: string | null;

  @ApiPropertyOptional({
    enum: ['BOOKING_CREATED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'CANCELLATION_REQUESTED', 'OPERATION_FAILED', 'APPOINTMENTS_LISTED'],
    description: 'Outcome code. Absent on a declined result.',
    example: 'BOOKING_CREATED',
  })
  outcome?: string;

  @ApiPropertyOptional({ description: 'True when the Zoom URL sync is still pending', example: true })
  syncPending?: boolean;
}

/**
 * One chat message as returned by `toChatMessageResponse`. `metadata` is
 * present only for the four allow-listed public variants.
 */
@ApiExtraModels(
  ClientChatHandoffMetadataDto,
  ClientChatAssistantRecoveryMetadataDto,
  ClientChatOperationCardMetadataDto,
  ClientChatOperationResultMetadataDto,
)
export class ClientChatMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Message UUID', example: '00000000-0000-4000-a000-000000000020' })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Conversation UUID', example: '00000000-0000-4000-a000-000000000001' })
  conversationId!: string;

  @ApiProperty({ enum: MessageSenderType, enumName: 'MessageSenderType', description: 'Who sent the message', example: 'CLIENT' })
  senderType!: MessageSenderType;

  @ApiProperty({ description: 'Message body', example: 'أريد حجز موعد' })
  body!: string;

  @ApiProperty({ enum: ChatMessageKind, enumName: 'ChatMessageKind', description: 'Message kind', example: 'TEXT' })
  kind!: ChatMessageKind;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client idempotency id echoed back, or null', example: '00000000-0000-4000-a000-000000000021' })
  clientMessageId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant', example: '2026-05-20T09:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({
    description: 'Sanitized public metadata; absent unless it matches an allow-listed variant',
    oneOf: [
      { $ref: '#/components/schemas/ClientChatHandoffMetadataDto' },
      { $ref: '#/components/schemas/ClientChatAssistantRecoveryMetadataDto' },
      { $ref: '#/components/schemas/ClientChatOperationCardMetadataDto' },
      { $ref: '#/components/schemas/ClientChatOperationResultMetadataDto' },
    ],
  })
  metadata?:
    | ClientChatHandoffMetadataDto
    | ClientChatAssistantRecoveryMetadataDto
    | ClientChatOperationCardMetadataDto
    | ClientChatOperationResultMetadataDto;
}

/** Cursor pagination metadata for the client message list. */
export class ClientChatMessagePageMetaDto {
  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100, description: 'Page size used for this read', example: 20 })
  limit!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Cursor for the next page, or null when exhausted', example: null })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether more messages exist after this page', example: false })
  hasMore!: boolean;
}

/** `GET /client/chat/conversations/:conversationId/messages` — cursor page. */
export class ClientChatMessagePageDto {
  @ApiProperty({ type: [ClientChatMessageDto], description: 'Messages on this page (newest first)' })
  data!: ClientChatMessageDto[];

  @ApiProperty({ type: ClientChatMessagePageMetaDto, description: 'Cursor pagination metadata' })
  meta!: ClientChatMessagePageMetaDto;
}
