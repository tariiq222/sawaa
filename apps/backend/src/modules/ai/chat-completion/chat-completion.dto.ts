import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatCompletionDto {
  @ApiProperty({ description: 'The user message to send to the chatbot', example: 'What are your clinic hours?' })
  @IsString() @MinLength(1) @MaxLength(4000) userMessage!: string;

  @ApiPropertyOptional({ description: 'Session UUID for conversation continuity', example: '00000000-0000-0000-0000-000000000010' })
  @IsOptional() @IsUUID() sessionId?: string;

  @ApiPropertyOptional({ description: 'Client UUID to associate with the session', example: '00000000-0000-0000-0000-000000000020' })
  @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional({ description: 'Staff user UUID to associate with the session', example: '00000000-0000-0000-0000-000000000030' })
  @IsOptional() @IsUUID() userId?: string;
}

export interface ChatCompletionResult {
  sessionId: string;
  reply: string;
  sourcesUsed: number;
}
