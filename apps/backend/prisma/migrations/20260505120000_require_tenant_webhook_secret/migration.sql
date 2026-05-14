-- Per-tenant webhook secret is now mandatory (2026-05-05).
-- Pre-launch: zero rows in OrganizationPaymentConfig, no backfill needed.
-- See moyasar-webhook.handler.ts: each tenant verifies its inbound Moyasar
-- webhook with its own decrypted secret instead of a shared global env var.

ALTER TABLE "OrganizationPaymentConfig"
  ALTER COLUMN "webhookSecretEnc" SET NOT NULL;
