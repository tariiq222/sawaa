import { ApiProperty } from '@nestjs/swagger';

/**
 * Response shapes of the Moyasar credential routes in
 * `dashboard/finance.controller.ts`.
 *
 * Documentation only. Security: every field below is what the handlers return.
 * `GetMoyasarConfigHandler` (get-moyasar-config.handler.ts:34-42) returns the
 * public publishable key and a masked `sk_…•••••••tail` string — never the
 * secret; `hasWebhookSecret` is a boolean. `UpsertMoyasarConfigHandler`
 * (upsert-moyasar-config.handler.ts:116-121) returns only `organizationId`,
 * `publishableKey`, `isLive`, `updatedAt`. `TestMoyasarConfigHandler`
 * (test-moyasar-config.handler.ts:72) returns `{ ok, status }`. No ciphertext
 * or plaintext secret crosses the wire, and this documentation does not change
 * that.
 */

const ISO_EXAMPLE = '2026-10-10T09:00:00.000Z';

/** `GET /dashboard/finance/moyasar/config` — null when unconfigured. */
export class MoyasarConfigViewDto {
  @ApiProperty({ description: 'Moyasar publishable key (pk_test_… / pk_live_…); not a secret', example: 'pk_test_12345678901234567890' })
  publishableKey!: string;

  @ApiProperty({ description: 'Masked secret key: prefix + bullets + the last four publishable-key characters', example: 'sk_test_•••••••7890' })
  secretKeyMasked!: string;

  @ApiProperty({ description: 'Whether an encrypted webhook signing secret is stored (the secret itself is never returned)', example: true })
  hasWebhookSecret!: boolean;

  @ApiProperty({ description: 'Whether the stored keys are live (production) keys', example: false })
  isLive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Last connectivity-test instant, or null', example: ISO_EXAMPLE })
  lastVerifiedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Last connectivity-test status, or null', example: 'OK' })
  lastVerifiedStatus!: string | null;

  @ApiProperty({ type: String, format: 'date-time', description: 'Last config update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `PATCH /dashboard/finance/moyasar/config` — the four fields the handler returns. */
export class MoyasarConfigUpsertResponseDto {
  @ApiProperty({ description: 'Fixed single-tenant organization id', example: '00000000-0000-0000-0000-000000000001' })
  organizationId!: string;

  @ApiProperty({ description: 'Moyasar publishable key that was stored', example: 'pk_test_12345678901234567890' })
  publishableKey!: string;

  @ApiProperty({ description: 'Whether the stored keys are live (production) keys', example: false })
  isLive!: boolean;

  @ApiProperty({ type: String, format: 'date-time', description: 'Config update instant', example: ISO_EXAMPLE })
  updatedAt!: Date;
}

/** `POST /dashboard/finance/moyasar/config/test` — connectivity probe result. */
export class MoyasarConfigTestResponseDto {
  @ApiProperty({ description: 'Whether the probe succeeded', example: true })
  ok!: boolean;

  @ApiProperty({ description: 'Probe status: OK, INVALID_KEY, NETWORK_ERROR or HTTP_<code>', example: 'OK' })
  status!: string;
}
