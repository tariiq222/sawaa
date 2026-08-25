import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageKind, ConversationStatus, MessageSenderType } from '@prisma/client';

/** Safe wire shape shared by the public chat endpoints. */
export class ChatConversationResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) clientId!: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) employeeId!: string | null;
  @ApiProperty() isAiChat!: boolean;
  @ApiProperty({ enum: ConversationStatus }) status!: ConversationStatus;
  @ApiProperty() language!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class ClaimGuestConversationResponseDto extends ChatConversationResponseDto {
  @ApiProperty({ type: 'array', items: { type: 'object', additionalProperties: true } })
  resumedOperations!: Record<string, unknown>[];
}

export class ChatMessageResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) conversationId!: string;
  @ApiProperty({ enum: MessageSenderType }) senderType!: MessageSenderType;
  @ApiProperty() body!: string;
  @ApiProperty({ enum: ChatMessageKind }) kind!: ChatMessageKind;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) clientMessageId!: string | null;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) metadata?: Record<string, unknown>;
}
