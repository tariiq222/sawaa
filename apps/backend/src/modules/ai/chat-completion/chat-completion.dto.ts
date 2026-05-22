import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// SECURITY (P0-4): clientId and userId are NOT accepted from request body anymore.
// They must be injected by the controller from the authenticated JWT/ClientSession
// to prevent impersonation and audit-trail spoofing.
export class ChatCompletionDto {
  @ApiProperty({ description: 'The user message to send to the chatbot', example: 'What are your clinic hours?' })
  @IsString() @MinLength(1) @MaxLength(4000) userMessage!: string;

  @ApiPropertyOptional({ description: 'Session UUID for conversation continuity', example: '00000000-0000-0000-0000-000000000010' })
  @IsOptional() @IsUUID() sessionId?: string;
}

// Internal command shape — controllers add caller identity here, never trust the body.
export interface ChatCompletionCommand {
  userMessage: string;
  sessionId?: string;
  clientId?: string;
  userId?: string;
}

export interface ChatCompletionResult {
  sessionId: string;
  reply: string;
  sourcesUsed: number;
}
