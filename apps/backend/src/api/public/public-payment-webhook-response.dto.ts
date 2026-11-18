import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Swagger response shape for `POST /public/payments/webhook`
 * (`MoyasarWebhookHandler` → `MoyasarWebhookResult`).
 *
 * The route NEVER answers 4xx: a malformed or unauthenticated delivery is
 * dropped-and-acked with HTTP 200 so the provider stops retrying. Every
 * permanent drop returns `{ skipped: true, reason }`; a settled delivery
 * returns an empty object `{}`. Only genuine infrastructure failures (a DB
 * error, a deadlock, or a claim that could not be taken) propagate as 5xx so
 * the provider retries.
 *
 * Documentation only — no serializer is registered, so this cannot shape an
 * acknowledgement, and nothing under `src/modules/**` imports it.
 */
export class PublicPaymentWebhookAckDto {
  @ApiPropertyOptional({
    description:
      'Present and true only when the delivery was dropped-and-acked without settling. Absent on a settled delivery (the body is then `{}`).',
    example: true,
  })
  skipped?: boolean;

  @ApiPropertyOptional({
    description:
      'Machine-readable drop reason, present only with `skipped`. Values implemented by the handler: ' +
      'missing_body (controller), missing_metadata, invoice_not_found, missing_payment_config, ' +
      'webhook_secret_decrypt_failed, invalid_signature, missing_signature, duplicate, payment_not_found, ' +
      'invoice_mismatch, identity_mismatch, terminal_invoice, currency_mismatch, already_refunded, ' +
      'invalid_transition, amount_mismatch, and the dynamic `non_terminal_status:<provider status>`.',
    example: 'invalid_signature',
  })
  reason?: string;
}
