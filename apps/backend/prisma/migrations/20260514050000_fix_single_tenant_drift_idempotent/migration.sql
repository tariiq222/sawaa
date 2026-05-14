-- Fix Single-Tenant Drift (idempotent rewrite)
-- Cleans up leftover schema inconsistencies after the SaaS → single-tenant
-- migration wave (20260513*). Safe to run on fresh or populated DB.
--
-- Replaces 20260514040000_fix_single_tenant_drift which incorrectly tried to
-- add a PRIMARY KEY on SiteSetting that already exists from the initial
-- migration (20260421071138). That migration was never applied to any real
-- database — only existed in source.

-- ─── 1. Drop temporary / orphaned objects ────────────────────────────────────

DROP TABLE IF EXISTS "_orphaned_refund_request_20260502";

ALTER TABLE "CouponRedemption" DROP CONSTRAINT IF EXISTS "CouponRedemption_couponId_clientId_key";
DROP INDEX IF EXISTS "PlatformMailDeliveryLog_templateName_idx";

-- ─── 2. Fix EmployeeAvailabilityException.endTime type ───────────────────────
-- The initial migration created this as TIME(3) but the Prisma schema models it
-- as DateTime (TIMESTAMP(3)). Backfills existing rows with NULL.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'EmployeeAvailabilityException'
      AND column_name = 'endTime'
      AND data_type = 'time without time zone'
  ) THEN
    ALTER TABLE "EmployeeAvailabilityException"
      ALTER COLUMN "endTime" TYPE TIMESTAMP(3) USING NULL;
  END IF;
END $$;

-- ─── 3. Fix OutboxEvent column constraints & types ───────────────────────────

ALTER TABLE "OutboxEvent"
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "publishedAt" SET DATA TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "lockedUntil" SET DATA TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- ─── 4. Create missing unique indexes ────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "Department_nameAr_key" ON "Department"("nameAr");
CREATE UNIQUE INDEX IF NOT EXISTS "Integration_provider_key" ON "Integration"("provider");

-- ─── 5. Create missing performance indexes ───────────────────────────────────

CREATE INDEX IF NOT EXISTS "ActivityLog_occurredAt_idx" ON "ActivityLog"("occurredAt");
CREATE INDEX IF NOT EXISTS "Invoice_status_dueAt_idx" ON "Invoice"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_status_idx" ON "NotificationDeliveryLog"("status");
CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_type_idx" ON "NotificationDeliveryLog"("type");
CREATE INDEX IF NOT EXISTS "OtpCode_identifier_channel_purpose_idx" ON "OtpCode"("identifier", "channel", "purpose");
CREATE INDEX IF NOT EXISTS "Payment_gatewayRef_idx" ON "Payment"("gatewayRef");

-- ─── 6. Rename legacy index to Prisma convention ─────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'fcm_token_per_client') THEN
    ALTER INDEX "fcm_token_per_client" RENAME TO "FcmToken_clientId_token_key";
  END IF;
END $$;

-- ─── 7. Drop unused enums (left over from deleted SaaS tables) ───────────────

DROP TYPE IF EXISTS "BillingCycle";
DROP TYPE IF EXISTS "InvitationStatus";
DROP TYPE IF EXISTS "MembershipRole";
DROP TYPE IF EXISTS "OrganizationStatus";
DROP TYPE IF EXISTS "SubscriptionInvoiceStatus";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "SuperAdminActionType";
DROP TYPE IF EXISTS "TemplateFamily";
DROP TYPE IF EXISTS "UsageMetric";
