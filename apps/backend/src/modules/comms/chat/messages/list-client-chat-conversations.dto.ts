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
  @ApiProperty({ enum: MessageSenderType }) senderType!: MessageSenderType;
  @ApiProperty({ enum: ChatMessageKind }) kind!: ChatMessageKind;
}

export class ClientChatConversationSummaryDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ConversationStatus }) status!: ConversationStatus;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true }) lastMessageAt!: Date | null;
  @ApiPropertyOptional({ type: ClientChatLastMessageDto, nullable: true }) lastMessage!: ClientChatLastMessageDto | null;
}

export class ClientChatConversationDetailDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() isAiChat!: boolean;
  @ApiProperty({ enum: ConversationStatus }) status!: ConversationStatus;
  @ApiProperty() language!: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: Date;
}

export class ClientChatConversationCursorMetaDto {
  @ApiProperty() limit!: number;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true }) nextCursor!: string | null;
  @ApiProperty() hasMore!: boolean;
}

export class ListClientChatConversationsResponseDto {
  @ApiProperty({ type: [ClientChatConversationSummaryDto] }) data!: ClientChatConversationSummaryDto[];
  @ApiProperty({ type: ClientChatConversationCursorMetaDto }) meta!: ClientChatConversationCursorMetaDto;
}
