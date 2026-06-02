import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoyasarWebhookMetadataDto {
  @ApiPropertyOptional({ description: 'Invoice UUID embedded in the payment metadata', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsString() invoiceId?: string;
}

/**
 * The PAYMENT object Moyasar nests under `data` in its documented webhook
 * delivery shape. The same fields may instead appear at the JSON root for
 * merchant configs / legacy callers — see {@link MoyasarWebhookDto}.
 */
export class MoyasarWebhookDataDto {
  @ApiPropertyOptional({ description: 'Moyasar payment ID', example: 'pay_abc123' })
  @IsOptional() @IsString() id?: string;

  @ApiPropertyOptional({ description: 'Payment status reported by Moyasar', enum: ['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'], example: 'paid' })
  @IsOptional() @IsIn(['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'])
  status?: 'paid' | 'failed' | 'refunded' | 'authorized' | 'captured' | 'voided';

  @ApiPropertyOptional({ description: 'Amount in the smallest currency unit (halalas)', example: 10000 })
  @IsOptional() @IsInt() @Min(1) @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  amount?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code', example: 'SAR' })
  @IsOptional() @IsString() @IsIn(['SAR']) currency?: string;

  @ApiPropertyOptional({ description: 'Metadata attached when the payment was initiated', type: () => MoyasarWebhookMetadataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookMetadataDto)
  metadata?: MoyasarWebhookMetadataDto;

  @ApiPropertyOptional({ description: 'Human-readable message from Moyasar (e.g. failure reason)', example: 'Insufficient funds' })
  @IsOptional() @IsString() message?: string;
}

/**
 * Moyasar webhook payload.
 *
 * Moyasar's documented delivery shape is NESTED: an event envelope at the
 * root (`id` = event id, `type`, `created_at`, `secret_token`) wrapping the
 * actual payment object under `data`. Some merchant setups / legacy callers
 * deliver the FLAT shape instead, with the payment fields (`id`, `status`,
 * `amount`, `currency`, `metadata`) at the JSON root.
 *
 * This DTO accepts BOTH: every field is optional and the handler normalizes
 * the two shapes into one internal object, then performs the real
 * "is this resolvable?" semantic check. The DTO is intentionally permissive
 * so a valid nested webhook is never hard-rejected by validation.
 */
export class MoyasarWebhookDto {
  @ApiPropertyOptional({ description: 'Payment ID (flat shape) OR event ID (nested shape)', example: 'pay_abc123' })
  @IsOptional() @IsString() id?: string;

  @ApiPropertyOptional({ description: 'Payment status reported by Moyasar (flat shape only)', enum: ['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'], example: 'paid' })
  @IsOptional() @IsIn(['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'])
  status?: 'paid' | 'failed' | 'refunded' | 'authorized' | 'captured' | 'voided';

  @ApiPropertyOptional({ description: 'Amount in the smallest currency unit (halalas) — flat shape only', example: 10000 })
  @IsOptional() @IsInt() @Min(1) @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  amount?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code (flat shape only)', example: 'SAR' })
  @IsOptional() @IsString() @IsIn(['SAR']) currency?: string;

  @ApiPropertyOptional({ description: 'Metadata attached when the payment was initiated (flat shape only)', type: () => MoyasarWebhookMetadataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookMetadataDto)
  metadata?: MoyasarWebhookMetadataDto;

  @ApiPropertyOptional({ description: 'Human-readable message from Moyasar (flat shape only)', example: 'Insufficient funds' })
  @IsOptional() @IsString() message?: string;

  @ApiPropertyOptional({ description: 'Nested payment object — the documented Moyasar webhook delivery shape', type: () => MoyasarWebhookDataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookDataDto)
  data?: MoyasarWebhookDataDto;

  @ApiPropertyOptional({ description: 'Indicates if the payment was made in live mode', example: true })
  @IsOptional() live?: unknown;

  @ApiPropertyOptional({ description: 'Webhook event type (nested shape)', example: 'payment_paid' })
  @IsOptional() @IsString() type?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 timestamp when the event was created', example: '2024-01-15T10:30:00Z' })
  @IsOptional() @IsString() created_at?: string;

  @ApiPropertyOptional({ description: 'Shared secret token — present when the merchant configures body-token verification instead of an HMAC header' })
  @IsOptional() @IsString() secret_token?: string;

  @ApiPropertyOptional({ description: 'Name of the account associated with the payment', example: 'My Account' })
  @IsOptional() @IsString() account_name?: string;
}
