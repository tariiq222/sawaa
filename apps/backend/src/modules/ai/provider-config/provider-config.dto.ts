import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, Matches, ValidatorConstraint, ValidatorConstraintInterface, ValidationArguments, Validate } from 'class-validator';
import { AiProvider } from './ai-provider-config.types';

const MODEL = /^[A-Za-z0-9._:-]+(?:\/[A-Za-z0-9._:-]+)?$/;
@ValidatorConstraint({ name: 'providerModel', async: false })
class ProviderModelConstraint implements ValidatorConstraintInterface { validate(model: unknown, args: ValidationArguments) { const provider = (args.object as { provider?: AiProvider }).provider; return typeof model === 'string' && (provider === AiProvider.OPENAI ? !model.includes('/') : provider === AiProvider.OPENROUTER ? model.includes('/') : provider === AiProvider.MINIMAX ? !model.includes('/') && model.startsWith('MiniMax-') : false); } }

export class UpsertAiProviderConfigDto {
  @ApiProperty({ enum: AiProvider }) @IsEnum(AiProvider) provider!: AiProvider;
  @ApiProperty({ example: 'openai/gpt-4o-mini' }) @IsString() @MinLength(1) @MaxLength(200) @Matches(MODEL) @Validate(ProviderModelConstraint) model!: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 2, default: 0.4 }) @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 32000, default: 800 }) @IsOptional() @IsInt() @Min(1) @Max(32000) maxTokens?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isEnabled?: boolean;
}

export class TestAiProviderConfigDto extends UpsertAiProviderConfigDto {
  @ApiProperty({ description: 'Write-only candidate API key. Never returned or persisted unless saveCredential is true.', writeOnly: true })
  @IsString() @MinLength(1) @MaxLength(4096) candidateApiKey!: string;
  @ApiPropertyOptional({ description: 'Persist the candidate only after the bounded test succeeds.' })
  @IsOptional() @IsBoolean() saveCredential?: boolean;
}

export class AiProviderConfigResponseDto {
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty() model!: string;
  @ApiProperty() temperature!: number;
  @ApiProperty() maxTokens!: number;
  @ApiProperty() isEnabled!: boolean;
  @ApiProperty() connectionStatus!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) lastTestedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Boolean }) lastTestOk!: boolean | null;
  @ApiProperty({ nullable: true, type: String }) lastTestErrorCode!: string | null;
  @ApiProperty() hasCredential!: boolean;
}

export class AiProviderTestResponseDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ nullable: true, type: String }) errorCode!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) testedAt!: Date | null;
  @ApiProperty() persisted!: boolean;
}

export class AiProviderModelSuggestionDto {
  @ApiProperty({ enum: AiProvider }) provider!: AiProvider;
  @ApiProperty({ type: [String] }) models!: string[];
  @ApiProperty() allowCustom!: boolean;
}
