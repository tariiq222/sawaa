import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AiProvider, DEFAULT_OPENROUTER_MODEL } from './ai-provider-config.types';

export class UpsertAiProviderConfigDto {
  @ApiProperty({ enum: AiProvider, description: 'AI provider to configure.', example: AiProvider.OPENROUTER }) @IsEnum(AiProvider) provider!: AiProvider;
  @ApiProperty({ description: 'Pinned model identifier; only the single supported OpenRouter model is accepted.', example: DEFAULT_OPENROUTER_MODEL, enum: [DEFAULT_OPENROUTER_MODEL] }) @IsString() @Equals(DEFAULT_OPENROUTER_MODEL) model!: string;
  @ApiPropertyOptional({ description: 'Sampling temperature from 0 to 2. Omitted keeps the stored value; a new configuration defaults to 0.4.', example: 0.4, minimum: 0, maximum: 2, default: 0.4 }) @IsOptional() @IsNumber() @Min(0) @Max(2) temperature?: number;
  @ApiPropertyOptional({ description: 'Maximum completion tokens from 1 to 32000, as a whole number. Omitted keeps the stored value; a new configuration defaults to 800.', example: 800, minimum: 1, maximum: 32000, default: 800 }) @IsOptional() @IsInt() @Min(1) @Max(32000) maxTokens?: number;
  @ApiPropertyOptional({ description: 'Enable the assistant. Enabling requires a stored credential whose successful test matches the current provider and model.', example: false }) @IsOptional() @IsBoolean() isEnabled?: boolean;
}

export class TestAiProviderConfigDto extends UpsertAiProviderConfigDto {
  @ApiProperty({ description: 'Write-only candidate API key. Never returned or persisted unless saveCredential is true.', writeOnly: true })
  @IsString() @MinLength(1) @MaxLength(4096) candidateApiKey!: string;
  @ApiPropertyOptional({ description: 'Persist the candidate only after the bounded test succeeds.' })
  @IsOptional() @IsBoolean() saveCredential?: boolean;
}

export class AiProviderConfigResponseDto {
  @ApiProperty({ enum: AiProvider, description: 'Configured AI provider identifier.', example: AiProvider.OPENROUTER }) provider!: AiProvider;
  @ApiProperty({ description: 'Pinned provider model identifier used for assistant completions.', example: DEFAULT_OPENROUTER_MODEL }) model!: string;
  @ApiProperty({ description: 'Sampling temperature currently configured for the provider, from 0 to 2.', example: 0.4 }) temperature!: number;
  @ApiProperty({ description: 'Maximum completion tokens currently configured for the provider, as a whole number.', example: 800 }) maxTokens!: number;
  @ApiProperty({ description: 'Whether the assistant may call the provider for this center.', example: false }) isEnabled!: boolean;
  @ApiProperty({ description: 'Derived connection state: NOT_CONFIGURED, CONNECTED, FAILED, or RETEST_REQUIRED after a provider or model change.', example: 'NOT_CONFIGURED' }) connectionStatus!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time', description: 'When the stored credential was last tested, or null if it never was.', example: '2026-03-01T10:00:00.000Z' }) lastTestedAt!: Date | null;
  @ApiProperty({ nullable: true, type: Boolean, description: 'Result of the last credential test, or null if no test has run.', example: true }) lastTestOk!: boolean | null;
  @ApiProperty({ nullable: true, type: String, description: 'Machine-readable code from the last failed credential test, or null when it succeeded or never ran.', example: 'PROVIDER_TIMEOUT' }) lastTestErrorCode!: string | null;
  @ApiProperty({ description: 'Whether an encrypted credential is stored. The credential itself is never returned.', example: true }) hasCredential!: boolean;
}

export class AiProviderTestResponseDto {
  @ApiProperty({ description: 'Whether the candidate credential completed a bounded provider call.', example: true }) ok!: boolean;
  @ApiProperty({ nullable: true, type: String, description: 'Machine-readable failure code when ok is false, otherwise null.', example: 'PROVIDER_RATE_LIMIT' }) errorCode!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time', description: 'When this candidate test ran.', example: '2026-03-01T10:00:00.000Z' }) testedAt!: Date | null;
  @ApiProperty({ description: 'Whether the candidate was saved, which only happens after a successful test with saveCredential set to true.', example: false }) persisted!: boolean;
}

export class AiProviderModelSuggestionDto {
  @ApiProperty({ enum: AiProvider, description: 'AI provider these suggestions apply to.', example: AiProvider.OPENROUTER }) provider!: AiProvider;
  @ApiProperty({ type: [String], description: 'Curated model identifiers allowed for this provider.', example: [DEFAULT_OPENROUTER_MODEL] }) models!: string[];
  @ApiProperty({ description: 'Whether clients may send a model identifier outside the curated list.', example: false }) allowCustom!: boolean;
}
