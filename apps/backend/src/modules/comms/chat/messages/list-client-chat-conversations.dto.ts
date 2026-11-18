import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageKind, ConversationStatus, MessageSenderType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListClientChatConversationsDto {
  @ApiPropertyOptional({ type: String, description: 'Cursor (conversation UUID) for keyset pagination', format: 'uuid' })
  @IsOptional() @IsUUID() cursor?: string;

  @ApiPropertyOptional({ description: 'Number of conversations to return', example: 20, maximum: 100 })
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
}

export class ClientChatLastMessageDto {
  @ApiProperty({ description: 'Whitespace-normalized safe message preview' }) preview!: string;
  @ApiProperty({ enum: MessageSenderType, description: 'Who sent the last message.', example: 'CLIENT' }) senderType!: MessageSenderType;
  @ApiProperty({ enum: ChatMessageKind, description: 'Kind of the last message.', example: 'TEXT' }) kind!: ChatMessageKind;
}

export class ClientChatConversationSummaryDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation UUID.', example: '00000000-0000-4000-a000-000000000001' }) id!: string;
  @ApiProperty({ enum: ConversationStatus, description: 'Conversation status.', example: 'AI_ACTIVE' }) status!: ConversationStatus;
  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant.', example: '2026-03-01T10:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant.', example: '2026-03-01T10:05:00.000Z' }) updatedAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the newest message was sent, or null when the conversation has none.', example: '2026-03-01T10:05:00.000Z' }) lastMessageAt!: Date | null;
  @ApiProperty({ type: ClientChatLastMessageDto, nullable: true, description: 'Preview of the newest message, or null when the conversation has none.', example: { preview: 'أريد حجز موعد', senderType: 'CLIENT', kind: 'TEXT' } }) lastMessage!: ClientChatLastMessageDto | null;
}

export class ClientChatConversationDetailDto {
  @ApiProperty({ format: 'uuid', description: 'Conversation UUID.', example: '00000000-0000-4000-a000-000000000001' }) id!: string;
  @ApiProperty({ description: 'Whether the assistant answers this conversation.', example: true }) isAiChat!: boolean;
  @ApiProperty({ enum: ConversationStatus, description: 'Conversation status.', example: 'AI_ACTIVE' }) status!: ConversationStatus;
  @ApiProperty({ description: 'Conversation language code.', example: 'ar' }) language!: string;
  @ApiProperty({ type: String, format: 'date-time', description: 'Creation instant.', example: '2026-03-01T10:00:00.000Z' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Last update instant.', example: '2026-03-01T10:05:00.000Z' }) updatedAt!: Date;
}

export class ClientChatConversationCursorMetaDto {
  @ApiProperty({ description: 'Page size actually applied to this read, after clamping to 1-100.', example: 20 }) limit!: number;
  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Conversation UUID to send as `cursor` for the next page, or null when this page is the last.', example: '00000000-0000-4000-a000-000000000001' }) nextCursor!: string | null;
  @ApiProperty({ description: 'Whether more conversations exist after this page.', example: false }) hasMore!: boolean;
}

export class ListClientChatConversationsResponseDto {
  @ApiProperty({ type: [ClientChatConversationSummaryDto], description: 'Conversations owned by the authenticated client, most recent activity first.', example: [] }) data!: ClientChatConversationSummaryDto[];
  @ApiProperty({ type: ClientChatConversationCursorMetaDto, description: 'Cursor pagination metadata.', example: { limit: 20, nextCursor: null, hasMore: false } }) meta!: ClientChatConversationCursorMetaDto;
}
