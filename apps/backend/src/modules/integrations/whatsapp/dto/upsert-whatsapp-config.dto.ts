import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const WHATSAPP_PROVIDERS = ['META_CLOUD', 'EVOLUTION_API'] as const;
export type WhatsappProviderName = (typeof WHATSAPP_PROVIDERS)[number];

export class UpsertWhatsappConfigDto {
  @ApiProperty({ example: 'EVOLUTION_API', enum: WHATSAPP_PROVIDERS })
  @IsIn(WHATSAPP_PROVIDERS)
  provider!: WhatsappProviderName;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertWhatsappAgentConfigDto {
  @ApiProperty({ example: 'anthropic/claude-3.5-haiku' })
  @IsString()
  @IsNotEmpty()
  aiModel!: string;

  @ApiProperty({ example: 0.4, minimum: 0, maximum: 2 })
  @IsNumber()
  @Min(0)
  @Max(2)
  aiTemperature!: number;

  @ApiProperty({ example: 800, minimum: 50, maximum: 4000 })
  @IsInt()
  @Min(50)
  @Max(4000)
  aiMaxTokens!: number;

  @ApiPropertyOptional({
    example: 'sk-or-v1-...',
    description: 'OpenRouter (or OpenAI-compatible) API key. Empty string clears the stored key.',
  })
  @IsOptional()
  @IsString()
  aiApiKey?: string;

  @ApiProperty({ example: 'أنت مساعد سوا...' })
  @IsString()
  systemPromptAr!: string;

  @ApiProperty({ example: 'You are Sawaa assistant...' })
  @IsString()
  systemPromptEn!: string;

  @ApiPropertyOptional({ example: 'أهلاً! كيف أقدر أساعدك؟' })
  @IsOptional()
  @IsString()
  greetingAr?: string;

  @ApiPropertyOptional({ example: 'Hi! How can I help?' })
  @IsOptional()
  @IsString()
  greetingEn?: string;

  @ApiProperty({ example: 'ar', enum: ['ar', 'en'] })
  @IsIn(['ar', 'en'])
  defaultLanguage!: 'ar' | 'en';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  businessHoursOnly?: boolean;

  @ApiPropertyOptional({
    example: [0, 1, 2, 3, 4],
    description: '0=Sunday..6=Saturday (Saudi week)',
  })
  @IsOptional()
  activeDays?: number[];
}

export class WhatsappControlDto {
  @ApiProperty({ enum: ['start', 'stop', 'restart'] })
  @IsIn(['start', 'stop', 'restart'])
  action!: 'start' | 'stop' | 'restart';
}

export class StaffReplyDto {
  @ApiProperty({ example: 'موعدك تأكد — الدفع عند الاستقبال' })
  @IsString()
  @IsNotEmpty()
  message!: string;
}
