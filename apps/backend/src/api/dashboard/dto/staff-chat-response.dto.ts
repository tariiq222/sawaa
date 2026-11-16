import { ApiProperty } from '@nestjs/swagger';
import {
  ChatMessageKind,
  ConversationStatus,
  MessageSenderType,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

/**
 * Response shapes of the legacy dashboard chat endpoints
 * (`dashboard/comms-chat.controller.ts`).
 *
 * These classes only document what the handlers already return. They are never
 * instantiated and no interceptor rewrites a payload, so they cannot change a
 * response. `staff-chat-response.dto.spec.ts` asserts the inferred handler
 * outputs are exactly these DTOs.
 *
 * Three of the five routes return raw Prisma rows (`ChatConversation` /
 * `CommsChatMessage`), so their schemas mirror the Prisma model exactly —
 * including JSON columns (`additionalProperties`, not an invented structure).
 * `sequence` is a Prisma `BigInt`; it is documented as an integer because that
 * is its database/JS value. See the unit report for the serialization caveat.
 */

const CONVERSATION_EXAMPLE = '00000000-4000-4000-a000-000000000001';
const MESSAGE_EXAMPLE = '00000000-4000-4000-a000-000000000002';
const CLIENT_EXAMPLE = '00000000-4000-4000-a000-000000000003';
const EMPLOYEE_EXAMPLE = '00000000-4000-4000-a000-000000000004';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** `user` projection on `GET /dashboard/comms/chat/conversations` rows. */
export class StaffChatConversationUserDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client UUID, or null for a guest conversation', example: CLIENT_EXAMPLE })
  id!: string | null;

  @ApiProperty({ description: 'Client first name, or an empty string when the client row is missing', example: 'سارة' })
  firstName!: string;

  @ApiProperty({ description: 'Client last name, or an empty string when the client row is missing', example: 'أحمد' })
  lastName!: string;
}

/** Message counter relation included by `ListConversationsHandler`. */
export class StaffChatConversationCountDto {
  @ApiProperty({ type: 'integer', description: 'Number of messages in the conversation', example: 12 })
  messages!: number;
}

/** `GET /dashboard/comms/chat/conversations` row (`ListConversationsHandler`). */
export class StaffChatConversationListRowDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation identifier', example: CONVERSATION_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client UUID, or null for a guest conversation', example: CLIENT_EXAMPLE })
  clientId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Employee UUID, or null when not tied to a practitioner', example: null })
  employeeId!: string | null;

  @ApiProperty({ description: 'Whether the conversation was handed off to a staff member', example: false })
  handedOff!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation start time (the row creation time)', example: ISO_EXAMPLE })
  startedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'End time for closed conversations, or null while open', example: null })
  endedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Timestamp of the latest message, or null', example: ISO_EXAMPLE })
  lastMessageAt!: Date | null;

  @ApiProperty({ type: StaffChatConversationUserDto, description: 'Client identity projection' })
  user!: StaffChatConversationUserDto;

  @ApiProperty({ type: StaffChatConversationCountDto, description: 'Joined message counter' })
  _count!: StaffChatConversationCountDto;
}

/** Pagination meta returned by `toListResponse` on the chat conversation list. */
export class StaffChatListMetaDto {
  @ApiProperty({ type: 'integer', description: 'Total matching conversations', example: 42 })
  total!: number;

  @ApiProperty({ type: 'integer', description: '1-based page number', example: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', description: 'Records per page', example: 20 })
  limit!: number;

  @ApiProperty({ type: 'integer', description: 'Total number of pages', example: 3 })
  totalPages!: number;

  @ApiProperty({ description: 'Whether a next page exists', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether a previous page exists', example: false })
  hasPreviousPage!: boolean;
}

/** `GET /dashboard/comms/chat/conversations` response. */
export class StaffChatConversationListResponseDto {
  @ApiProperty({ type: [StaffChatConversationListRowDto], description: 'Conversations on the requested page' })
  items!: StaffChatConversationListRowDto[];

  @ApiProperty({ type: StaffChatListMetaDto, description: 'Pagination metadata' })
  meta!: StaffChatListMetaDto;
}

/** Message row embedded in `GET /dashboard/comms/chat/conversations/:id`. */
export class StaffChatConversationMessageDto {
  @ApiProperty({ format: 'uuid', description: 'Message identifier', example: MESSAGE_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Conversation the message belongs to', example: CONVERSATION_EXAMPLE })
  conversationId!: string;

  @ApiProperty({
    description: 'Legacy role derived from the stored sender type',
    enum: ['user', 'staff', 'assistant'],
    example: 'user',
  })
  role!: 'user' | 'staff' | 'assistant';

  @ApiProperty({ description: 'Message body', example: 'أرغب بمعرفة مواعيد الجلسات' })
  content!: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'Message creation timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/**
 * `GET /dashboard/comms/chat/conversations/:id` (`GetConversationHandler` in
 * `modules/comms/chat/get-conversation.handler.ts`). This is a derived
 * projection, not the raw chat-session table.
 */
export class StaffChatConversationDetailDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation identifier', example: CONVERSATION_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client UUID, or null for a guest conversation', example: CLIENT_EXAMPLE })
  clientId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Employee UUID, or null when not tied to a practitioner', example: EMPLOYEE_EXAMPLE })
  employeeId!: string | null;

  @ApiProperty({ description: 'Whether the conversation is assigned to an employee', example: true })
  handedOff!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation start time (the row creation time)', example: ISO_EXAMPLE })
  startedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'End time for closed conversations, or null while open', example: null })
  endedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Timestamp of the latest message, or null', example: ISO_EXAMPLE })
  lastMessageAt!: Date | null;

  @ApiProperty({ type: StaffChatConversationUserDto, description: 'Client identity projection' })
  user!: StaffChatConversationUserDto;

  @ApiProperty({ type: [StaffChatConversationMessageDto], description: 'All messages in ascending creation order' })
  messages!: StaffChatConversationMessageDto[];
}

/**
 * Raw `CommsChatMessage` row returned by
 * `POST /dashboard/comms/chat/conversations/:id/messages` and by
 * `GET .../messages` (`SendStaffMessageHandler` / `ListMessagesHandler`).
 *
 * `metadata` is an arbitrary Prisma `Json` column, so it is documented as free
 * JSON rather than a structure the endpoint does not enforce.
 */
export class StaffChatMessageRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Message identifier', example: MESSAGE_EXAMPLE })
  id!: string;

  @ApiProperty({ format: 'uuid', description: 'Conversation the message belongs to', example: CONVERSATION_EXAMPLE })
  conversationId!: string;

  @ApiProperty({ enum: MessageSenderType, description: 'Stored sender type', example: 'EMPLOYEE' })
  senderType!: MessageSenderType;

  @ApiProperty({ type: String, nullable: true, description: 'Dashboard user that sent the message, or null', example: null })
  senderId!: string | null;

  @ApiProperty({ description: 'Message body', example: 'تم تأكيد موعدك.' })
  body!: string;

  @ApiProperty({ enum: ChatMessageKind, description: 'Message kind', example: 'TEXT' })
  kind!: ChatMessageKind;

  @ApiProperty({
    description: 'Stored metadata JSON (arbitrary Prisma Json value), or null',
    oneOf: [
      { type: 'string', nullable: true },
      { type: 'number', nullable: true },
      { type: 'boolean', nullable: true },
      { type: 'array', items: {} },
      { type: 'object', additionalProperties: true, nullable: true },
    ],
    example: null,
  })
  metadata!: Prisma.JsonValue | null;

  @ApiProperty({ type: String, nullable: true, description: 'Client-generated idempotency identifier, or null', example: null })
  clientMessageId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Message this row answers, or null', example: null })
  responseForMessageId!: string | null;

  @ApiProperty({ type: 'integer', format: 'int64', description: 'Monotonic message sequence (Prisma BigInt)', example: 42 })
  sequence!: bigint;

  @ApiProperty({ type: String, nullable: true, description: 'AI model that produced the message, or null', example: null })
  model!: string | null;

  @ApiProperty({ type: 'integer', description: 'Tokens consumed by the assistant reply', example: 0 })
  tokensUsed!: number;

  @ApiProperty({ type: 'integer', nullable: true, description: 'Assistant latency in milliseconds, or null', example: null })
  latencyMs!: number | null;

  @ApiProperty({ description: 'Whether the message has been read', example: false })
  isRead!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Read timestamp, or null', example: null })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Message creation timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/** Keyset pagination meta for the legacy chat message list. */
export class StaffChatCursorMetaDto {
  @ApiProperty({ type: 'integer', description: 'Page size used for the response', example: 20 })
  limit!: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Cursor for the next page, or null when exhausted', example: null })
  nextCursor!: string | null;

  @ApiProperty({ description: 'Whether another page exists', example: false })
  hasMore!: boolean;
}

/** `GET /dashboard/comms/chat/conversations/:id/messages` response. */
export class StaffChatMessageListResponseDto {
  @ApiProperty({ type: [StaffChatMessageRecordDto], description: 'Messages on the requested page (newest first)' })
  data!: StaffChatMessageRecordDto[];

  @ApiProperty({ type: StaffChatCursorMetaDto, description: 'Keyset pagination metadata' })
  meta!: StaffChatCursorMetaDto;
}

/**
 * Raw `ChatConversation` row returned by
 * `PATCH /dashboard/comms/chat/conversations/:id/close`
 * (`CloseConversationHandler`). Mirrors the Prisma model, including the
 * `customerContext` JSON column and the guest token hash.
 */
export class StaffChatConversationRecordDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation identifier', example: CONVERSATION_EXAMPLE })
  id!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Client UUID, or null for a guest conversation', example: null })
  clientId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Employee UUID, or null', example: EMPLOYEE_EXAMPLE })
  employeeId!: string | null;

  @ApiProperty({ description: 'Whether the administrative assistant handles the conversation', example: true })
  isAiChat!: boolean;

  @ApiProperty({ enum: ConversationStatus, description: 'Conversation lifecycle status', example: 'CLOSED' })
  status!: ConversationStatus;

  @ApiProperty({ type: 'integer', description: 'Optimistic concurrency version', example: 3 })
  stateVersion!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Stored guest token hash, or null for signed-in clients', example: null })
  guestTokenHash!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Guest display name, or null', example: 'سارة' })
  guestName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Guest phone number, or null', example: '+966501234567' })
  guestPhone!: string | null;

  @ApiProperty({ description: 'Conversation language code', example: 'ar' })
  language!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Dashboard user handling the conversation, or null', example: null })
  assignedStaffUserId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the visitor requested a human hand-off, or null', example: null })
  handoffRequestedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When a dashboard user claimed the conversation, or null', example: null })
  staffClaimedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the conversation was closed, or null', example: ISO_EXAMPLE })
  closedAt!: Date | null;

  @ApiProperty({ type: 'integer', description: 'Unread messages for staff', example: 0 })
  staffUnreadCount!: number;

  @ApiProperty({ type: 'integer', description: 'Unread messages for the visitor', example: 0 })
  clientUnreadCount!: number;

  @ApiProperty({
    description: 'Stored customer-context JSON (arbitrary Prisma Json value), or null',
    oneOf: [
      { type: 'string', nullable: true },
      { type: 'number', nullable: true },
      { type: 'boolean', nullable: true },
      { type: 'array', items: {} },
      { type: 'object', additionalProperties: true, nullable: true },
    ],
    example: null,
  })
  customerContext!: Prisma.JsonValue | null;

  @ApiProperty({ type: 'integer', description: 'Customer-context schema version', example: 0 })
  customerContextVersion!: number;

  @ApiProperty({ type: String, nullable: true, description: 'Administrative-assistant lease owner, or null', example: null })
  assistantLeaseOwner!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Assistant lease expiry, or null', example: null })
  assistantLeaseExpiresAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Timestamp of the latest message, or null', example: ISO_EXAMPLE })
  lastMessageAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation creation timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Conversation update timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}
