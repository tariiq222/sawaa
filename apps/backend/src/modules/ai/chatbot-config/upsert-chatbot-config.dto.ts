import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * SaaS-02f: restructured from key/value shape to a typed singleton.
 * `settings` remains as a free-form JSON blob for forward-compat keys.
 */
export class UpsertChatbotConfigDto {
  @ApiPropertyOptional({ description: 'System prompt (Arabic)', example: 'أنت مساعد...' })
  @IsOptional()
  @IsString()
  systemPromptAr?: string;

  @ApiPropertyOptional({ description: 'System prompt (English)', example: 'You are an assistant...' })
  @IsOptional()
  @IsString()
  systemPromptEn?: string;

  @ApiPropertyOptional({ description: 'Greeting shown on chat open (Arabic)', example: 'مرحباً، كيف يمكنني مساعدتك؟' })
  @IsOptional()
  @IsString()
  greetingAr?: string;

  @ApiPropertyOptional({ description: 'Greeting shown on chat open (English)', example: 'Hi! How can I help?' })
  @IsOptional()
  @IsString()
  greetingEn?: string;

  @ApiPropertyOptional({
    description: 'Auto-escalate to human after N messages. Null disables.',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  escalateToHumanAt?: number;

  @ApiPropertyOptional({
    description: 'Free-form settings blob for future keyed configuration.',
    example: { tone: 'friendly' },
  })
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
