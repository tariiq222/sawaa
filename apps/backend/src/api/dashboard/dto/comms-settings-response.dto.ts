import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SmsDeliveryStatus, SmsProvider } from '@prisma/client';

/**
 * Response shapes of the dashboard comms settings routes
 * (`comms.controller.ts`).
 *
 * These classes only document what the handlers return. They are never
 * instantiated and no interceptor rewrites the payload, so they cannot change a
 * response. The settings views are the same object the handlers hand back:
 * provider credentials are write-only, so the only credential-related field is
 * the boolean `credentialsConfigured`; neither `credentialsCiphertext` nor the
 * SMS `webhookSecret` is selected or returned. `comms-response.dto.spec.ts`
 * asserts each handler result is exactly its DTO.
 */

const UUID_EXAMPLE = '00000000-0000-4000-a000-0000000000c1';
const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** Bilingual provider error carried inside a settings test result. */
export class CommsBilingualErrorDto {
  @ApiProperty({ description: 'Arabic error message', example: 'فشل إرسال رسالة الاختبار: timeout' })
  ar!: string;

  @ApiProperty({ description: 'English error message', example: 'Failed to send test email: timeout' })
  en!: string;
}

/** `GET /dashboard/comms/settings/sms` and its POST upsert (`GetOrgSmsConfigHandler` / `UpsertOrgSmsConfigHandler`). */
export class SmsSettingsResponseDto {
  @ApiProperty({ format: 'uuid', description: 'SMS configuration row identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ enum: ['NONE', 'UNIFONIC', 'TAQNYAT'], description: 'Configured SMS provider', example: 'TAQNYAT' })
  provider!: 'NONE' | 'UNIFONIC' | 'TAQNYAT';

  @ApiProperty({ type: String, nullable: true, description: 'Registered sender ID shown to recipients, or null when unset', example: 'Sawaa' })
  senderId!: string | null;

  @ApiProperty({ description: 'Whether encrypted provider credentials are stored (credentials themselves are never returned)', example: true })
  credentialsConfigured!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Last test send time as an ISO 8601 UTC timestamp, or null when never tested', example: null })
  lastTestAt!: Date | null;

  @ApiProperty({ type: Boolean, nullable: true, description: 'Whether the last test send succeeded, or null when never tested', example: null })
  lastTestOk!: boolean | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `POST /dashboard/comms/settings/sms/test` (`TestSmsConfigHandler.execute`). */
export class SmsSettingsTestResultDto {
  @ApiProperty({ description: 'Whether the provider accepted the test message', example: true })
  ok!: boolean;

  @ApiPropertyOptional({ description: 'Provider-assigned message identifier when the send succeeded', example: 'provider-message-example' })
  providerMessageId?: string;

  @ApiPropertyOptional({ type: CommsBilingualErrorDto, description: 'Bilingual failure reason when the send failed' })
  error?: CommsBilingualErrorDto;
}

/** `GET /dashboard/comms/settings/email` and its POST upsert (`GetOrgEmailConfigHandler` / `UpsertOrgEmailConfigHandler`). */
export class EmailSettingsResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Email configuration row identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ enum: ['NONE', 'SMTP', 'RESEND', 'SENDGRID', 'MAILCHIMP'], description: 'Configured email provider', example: 'RESEND' })
  provider!: 'NONE' | 'SMTP' | 'RESEND' | 'SENDGRID' | 'MAILCHIMP';

  @ApiProperty({ type: String, nullable: true, description: 'Sender display name, or null when unset', example: 'عيادة سواء' })
  senderName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Sender email address, or null when unset', example: 'noreply@example.com' })
  senderEmail!: string | null;

  @ApiProperty({ description: 'Whether encrypted provider credentials are stored (credentials themselves are never returned)', example: true })
  credentialsConfigured!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Last test send time as an ISO 8601 UTC timestamp, or null when never tested', example: null })
  lastTestAt!: Date | null;

  @ApiProperty({ type: Boolean, nullable: true, description: 'Whether the last test send succeeded, or null when never tested', example: null })
  lastTestOk!: boolean | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last update time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `POST /dashboard/comms/settings/email/test` (`TestEmailConfigHandler.execute`). */
export class EmailSettingsTestResultDto {
  @ApiProperty({ description: 'Whether the provider accepted the test message', example: true })
  ok!: boolean;

  @ApiPropertyOptional({ description: 'Provider-assigned message identifier when the send succeeded', example: 'provider-message-example' })
  messageId?: string;

  @ApiPropertyOptional({ type: CommsBilingualErrorDto, description: 'Bilingual failure reason when the send failed' })
  error?: CommsBilingualErrorDto;
}

/** One row of `GET /dashboard/comms/settings/sms/deliveries` (`ListSmsDeliveriesHandler.execute`). */
export class SmsDeliveryResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Delivery row identifier', example: UUID_EXAMPLE })
  id!: string;

  @ApiProperty({ enum: SmsProvider, description: 'Provider that handled the message', example: 'TAQNYAT' })
  provider!: SmsProvider;

  @ApiProperty({ description: 'Recipient phone number as stored', example: '+966500000000' })
  toPhone!: string;

  @ApiProperty({ enum: SmsDeliveryStatus, description: 'Current delivery status from the provider callback', example: 'DELIVERED' })
  status!: SmsDeliveryStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Provider-assigned message identifier, or null before acceptance', example: 'provider-message-example' })
  providerMessageId!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Provider error text, or null when the message succeeded', example: null })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Send time as an ISO 8601 UTC timestamp, or null while queued', example: ISO_EXAMPLE })
  sentAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Delivery confirmation time as an ISO 8601 UTC timestamp, or null until delivered', example: ISO_EXAMPLE })
  deliveredAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Creation time as an ISO 8601 UTC timestamp', example: ISO_EXAMPLE })
  createdAt!: Date;
}

/**
 * `GET /dashboard/comms/settings/sms/deliveries`. The handler returns
 * `{ items }` only — there is no pagination metadata because it always takes
 * the 50 most recent rows.
 */
export class SmsDeliveryListResponseDto {
  @ApiProperty({ type: [SmsDeliveryResponseDto], description: 'The 50 most recent SMS deliveries, newest first' })
  items!: SmsDeliveryResponseDto[];
}
