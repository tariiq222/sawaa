-- Fix Single-Tenant Drift
-- Cleans up leftover schema inconsistencies after the SaaS → single-tenant
-- migration wave (20260513*). Safe to run on an empty or populated DB.
--
-- Skipped (intentionally kept as-is):
--   * id-column defaults using gen_random_uuid() — functionally equivalent to
--     Prisma @default(uuid()) and safe to retain for raw-SQL inserts.
--   * DocumentChunk_embedding_ivfflat_idx — pgvector IVFFLAT index managed
--     outside Prisma; dropping it would break semantic search.

-- ─── 1. Drop temporary / orphaned objects ────────────────────────────────────

DROP TABLE IF EXISTS "_orphaned_refund_request_20260502";

ALTER TABLE "CouponRedemption" DROP CONSTRAINT IF EXISTS "CouponRedemption_couponId_clientId_key";
DROP INDEX IF EXISTS "PlatformMailDeliveryLog_templateName_idx";

-- ─── 2. Fix missing Primary Key ──────────────────────────────────────────────

ALTER TABLE "SiteSetting" ADD CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key");

-- ─── 3. Fix EmployeeAvailabilityException.endTime type ───────────────────────
-- The initial migration created this as TIME(3) but the Prisma schema models it
-- as DateTime (TIMESTAMP(3)). Since the column stores a wall-clock cutoff on the
-- exception's last day, TIMESTAMP(3) is the correct type to match the schema.
-- All existing rows are backfilled with NULL (no data loss — column semantics
-- stay identical because the application never relied on the TIME-only type).

ALTER TABLE "EmployeeAvailabilityException"
  ALTER COLUMN "endTime" TYPE TIMESTAMP(3) USING NULL;

-- ─── 4. Fix OutboxEvent column constraints & types ───────────────────────────

ALTER TABLE "OutboxEvent"
  ALTER COLUMN "createdAt" SET NOT NULL,
  ALTER COLUMN "publishedAt" SET DATA TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "lockedUntil" SET DATA TYPE TIMESTAMPTZ(3),
  ALTER COLUMN "failedAt" SET DATA TYPE TIMESTAMPTZ(3);

-- ─── 5. Create missing unique indexes ────────────────────────────────────────

CREATE UNIQUE INDEX "Department_nameAr_key" ON "Department"("nameAr");
CREATE UNIQUE INDEX "Integration_provider_key" ON "Integration"("provider");

-- ─── 6. Create missing performance indexes ───────────────────────────────────

CREATE INDEX "ActivityLog_occurredAt_idx" ON "ActivityLog"("occurredAt");
CREATE INDEX "Invoice_status_dueAt_idx" ON "Invoice"("status", "dueAt");
CREATE INDEX "NotificationDeliveryLog_status_idx" ON "NotificationDeliveryLog"("status");
CREATE INDEX "NotificationDeliveryLog_type_idx" ON "NotificationDeliveryLog"("type");
CREATE INDEX "OtpCode_identifier_channel_purpose_idx" ON "OtpCode"("identifier", "channel", "purpose");
CREATE INDEX "Payment_gatewayRef_idx" ON "Payment"("gatewayRef");

-- ─── 7. Rename legacy index to Prisma convention ─────────────────────────────

ALTER INDEX "fcm_token_per_client" RENAME TO "FcmToken_clientId_token_key";

-- ─── 8. Drop unused enums (left over from deleted SaaS tables) ───────────────

DROP TYPE IF EXISTS "BillingCycle";
DROP TYPE IF EXISTS "InvitationStatus";
DROP TYPE IF EXISTS "MembershipRole";
DROP TYPE IF EXISTS "OrganizationStatus";
DROP TYPE IF EXISTS "SubscriptionInvoiceStatus";
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "SuperAdminActionType";
DROP TYPE IF EXISTS "TemplateFamily";
DROP TYPE IF EXISTS "UsageMetric";
