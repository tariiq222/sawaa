import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageKind, ConversationStatus, MessageSenderType } from '@prisma/client';

/** Safe wire shape shared by the public chat endpoints. */
export class ChatConversationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation UUID.', example: '00000000-0000-4000-a000-000000000001' }) id!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Owning client UUID, or null for a guest conversation.', example: '00000000-0000-4000-a000-000000000002' }) clientId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Assigned employee UUID, or null.', example: null }) employeeId!: string | null;
  @ApiProperty({ description: 'Whether the assistant answers this conversation.', example: true }) isAiChat!: boolean;
  @ApiProperty({ enum: ConversationStatus, description: 'Conversation status.', example: 'AI_ACTIVE' }) status!: ConversationStatus;
  @ApiProperty({ description: 'Conversation language code.', example: 'ar' }) language!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant.', example: '2026-03-01T10:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant.', example: '2026-03-01T10:05:00.000Z' }) updatedAt!: Date;
}

export class ClaimGuestConversationResponseDto extends ChatConversationResponseDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'object', additionalProperties: true },
    description:
      'Chat operations re-linked to the authenticated client by the claim, each a public-safe operation projection. Empty when nothing was pending.',
    example: [],
  })
  resumedOperations!: Record<string, unknown>[];
}

export class ChatMessageResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Message UUID.', example: '00000000-0000-4000-a000-000000000020' }) id!: string;
  @ApiProperty({ format: 'uuid', description: 'Conversation UUID the message belongs to.', example: '00000000-0000-4000-a000-000000000001' }) conversationId!: string;
  @ApiProperty({ enum: MessageSenderType, description: 'Who sent the message.', example: 'CLIENT' }) senderType!: MessageSenderType;
  @ApiProperty({ description: 'Message text as stored for the conversation.', example: 'أريد حجز موعد' }) body!: string;
  @ApiProperty({ enum: ChatMessageKind, description: 'Message kind: plain text, action card, operation result, or system event.', example: 'TEXT' }) kind!: ChatMessageKind;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true, description: 'Client idempotency id echoed back, or null when the client sent none.', example: '00000000-0000-4000-a000-000000000021' }) clientMessageId!: string | null;
  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant.', example: '2026-03-01T10:00:00.000Z' }) createdAt!: Date;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Sanitized free-form public metadata; present only when it matches an allow-listed variant.',
    example: { action: 'OFFER_HANDOFF', reason: 'USER_REQUESTED' },
  })
  metadata?: Record<string, unknown>;
}
