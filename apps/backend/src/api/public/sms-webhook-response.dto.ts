import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger response shape for `POST /public/sms/webhooks/{provider}`
 * (`SmsDlrHandler.execute` → `{ skipped?: boolean }`).
 *
 * A receipt that is applied or deduplicated returns an empty object `{}`; only
 * a stale/duplicate/unmatched delivery returns `{ skipped: true }`. The
 * provider is expected to treat any 2xx as acknowledged.
 *
 * Documentation only — no serializer is registered; nothing under `src/modules`
 * imports this layer.
 */
export class SmsWebhookDeliveryReceiptAckDto {
  @ApiPropertyOptional({
    description:
      'Present and true only when the receipt was acknowledged without changing a delivery row ' +
      '(duplicate event id, stale out-of-order receipt, no SMS config, or provider mismatch). Absent on an applied receipt.',
    example: true,
  })
  skipped?: boolean;
}
