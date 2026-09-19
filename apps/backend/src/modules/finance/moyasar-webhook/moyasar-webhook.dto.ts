import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoyasarWebhookMetadataDto {
  @ApiPropertyOptional({ description: 'Invoice UUID embedded in the payment metadata', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsString() invoiceId?: string;

  @ApiPropertyOptional({ description: 'Booking identity embedded in the payment metadata', example: 'booking_abc123' })
  @IsOptional() @IsString() bookingId?: string;

  @ApiPropertyOptional({ description: 'Internal source label embedded in the payment metadata', example: 'public-booking' })
  @IsOptional() @IsString() source?: string;

  @ApiPropertyOptional({ description: 'Internal payment identity embedded in the payment metadata', example: 'payment_abc123' })
  @IsOptional() @IsString() internalPaymentId?: string;

  @ApiPropertyOptional({ description: 'Package purchase identity embedded in the payment metadata', example: 'purchase_abc123' })
  @IsOptional() @IsString() packagePurchaseId?: string;
}

type MoyasarPaymentStatus = 'paid' | 'failed' | 'refunded' | 'authorized' | 'captured' | 'voided';

/**
 * Fields shared by Moyasar's nested payment object and the supported flat
 * payment shape. Auxiliary provider fields are validated only by their outer
 * JSON type; the handler re-fetches the payment before making decisions.
 */
export class MoyasarWebhookPaymentFieldsDto {
  @ApiPropertyOptional({ description: 'Moyasar payment ID (or event ID in the nested envelope)', example: 'pay_abc123' })
  @IsOptional() @IsString() id?: string;

  @ApiPropertyOptional({ description: 'Moyasar hosted-checkout invoice ID', example: 'inv_abc123' })
  @IsOptional() @IsString() invoice_id?: string;

  @ApiPropertyOptional({ description: 'Payment status reported by Moyasar', enum: ['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'], example: 'paid' })
  @IsOptional() @IsIn(['paid', 'failed', 'refunded', 'authorized', 'captured', 'voided'])
  status?: MoyasarPaymentStatus;

  @ApiPropertyOptional({ description: 'Amount in the smallest currency unit (halalas)', example: 10000 })
  @IsOptional() @IsInt() @Min(1) @Transform(({ value }) => (typeof value === 'string' ? parseInt(value, 10) : value))
  amount?: number;

  @ApiPropertyOptional({ description: 'Estimated payment fee in the smallest currency unit', example: 250 })
  @IsOptional() @IsInt() fee?: number;

  @ApiPropertyOptional({ description: 'Amount refunded in the smallest currency unit', example: 0 })
  @IsOptional() @IsInt() refunded?: number;

  @ApiPropertyOptional({ description: 'Timestamp when the payment was refunded', example: '2026-09-19T18:43:34.000Z' })
  @IsOptional() @IsString() refunded_at?: string;

  @ApiPropertyOptional({ description: 'Amount captured in the smallest currency unit', example: 10000 })
  @IsOptional() @IsInt() captured?: number;

  @ApiPropertyOptional({ description: 'Timestamp when the payment was captured', example: '2026-09-19T18:43:34.000Z' })
  @IsOptional() @IsString() captured_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when the payment was voided', example: '2026-09-19T18:43:34.000Z' })
  @IsOptional() @IsString() voided_at?: string;

  @ApiPropertyOptional({ description: 'Human-readable payment description', example: 'Counseling booking' })
  @IsOptional() @IsString() description?: string;

  @ApiPropertyOptional({ description: 'Formatted payment amount with currency', example: '100.00 SAR' })
  @IsOptional() @IsString() amount_format?: string;

  @ApiPropertyOptional({ description: 'Formatted payment fee with currency', example: '2.50 SAR' })
  @IsOptional() @IsString() fee_format?: string;

  @ApiPropertyOptional({ description: 'Formatted refunded amount with currency', example: '0.00 SAR' })
  @IsOptional() @IsString() refunded_format?: string;

  @ApiPropertyOptional({ description: 'Formatted captured amount with currency', example: '100.00 SAR' })
  @IsOptional() @IsString() captured_format?: string;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code', example: 'SAR' })
  @IsOptional() @IsString() @IsIn(['SAR']) currency?: string;

  @ApiPropertyOptional({ description: 'Payer IP address reported by Moyasar', example: '127.0.0.1' })
  @IsOptional() @IsString() ip?: string;

  @ApiPropertyOptional({ description: 'Payment callback URL', example: 'https://sawaa.test/payment/callback' })
  @IsOptional() @IsString() callback_url?: string;

  @ApiPropertyOptional({ description: 'Timestamp when the payment was created', example: '2026-09-19T18:43:30.000Z' })
  @IsOptional() @IsString() created_at?: string;

  @ApiPropertyOptional({ description: 'Timestamp when the payment was last updated', example: '2026-09-19T18:43:34.000Z' })
  @IsOptional() @IsString() updated_at?: string;

  @ApiPropertyOptional({ description: 'Payment source details returned by Moyasar', type: Object })
  @IsOptional() @IsObject() source?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Payment split details returned by Moyasar', type: [Object] })
  @IsOptional() @IsArray() splits?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Metadata attached when the payment was initiated', type: () => MoyasarWebhookMetadataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookMetadataDto)
  metadata?: MoyasarWebhookMetadataDto;

  @ApiPropertyOptional({ description: 'Human-readable message from Moyasar (e.g. failure reason)', example: 'Insufficient funds' })
  @IsOptional() @IsString() message?: string;
}

/**
 * The PAYMENT object Moyasar nests under `data` in its documented webhook
 * delivery shape. The same fields may instead appear at the JSON root for
 * merchant configs / legacy callers — see {@link MoyasarWebhookDto}.
 */
export class MoyasarWebhookDataDto extends MoyasarWebhookPaymentFieldsDto {}

/**
 * Moyasar webhook payload.
 *
 * Moyasar's documented delivery shape is NESTED: an event envelope at the
 * root (`id` = event id, `type`, `created_at`, `secret_token`) wrapping the
 * actual payment object under `data`. Some merchant setups / legacy callers
 * deliver the FLAT shape instead, with the payment fields at the JSON root.
 * Both shapes share the payment fields above and retain strict validation for
 * fields consumed by the handler.
 */
export class MoyasarWebhookDto extends MoyasarWebhookPaymentFieldsDto {
  @ApiPropertyOptional({ description: 'Nested payment object — the documented Moyasar webhook delivery shape', type: () => MoyasarWebhookDataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookDataDto)
  data?: MoyasarWebhookDataDto;

  @ApiPropertyOptional({ description: 'Indicates if the payment was made in live mode', example: true })
  @IsOptional() live?: unknown;

  @ApiPropertyOptional({ description: 'Webhook event type (nested shape)', example: 'payment_paid' })
  @IsOptional() @IsString() type?: string;

  @ApiPropertyOptional({ description: 'Shared secret token — present when the merchant configures body-token verification instead of an HMAC header' })
  @IsOptional() @IsString() secret_token?: string;

  @ApiPropertyOptional({ description: 'Name of the account associated with the payment', example: 'My Account' })
  @IsOptional() @IsString() account_name?: string;
}
