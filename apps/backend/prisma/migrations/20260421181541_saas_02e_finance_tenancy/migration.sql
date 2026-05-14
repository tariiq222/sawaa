-- SaaS-02e: Finance cluster tenant rollout
-- Adds organizationId to 7 finance models, backfills with DEFAULT_ORG_ID,
-- drops Coupon.code unique and replaces with composite, converts ZatcaConfig
-- from id-based singleton ("default") to organizationId-unique singleton.

-- 1. Invoice
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_idx" ON "Invoice"("organizationId");

-- 2. Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Payment" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "Payment_organizationId_idx" ON "Payment"("organizationId");

-- 3. Coupon — add orgId, swap unique index (drop global code unique, add composite)
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "Coupon" ALTER COLUMN "organizationId" DROP DEFAULT;
DROP INDEX IF EXISTS "Coupon_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_organizationId_code_key" ON "Coupon"("organizationId", "code");
CREATE INDEX IF NOT EXISTS "Coupon_organizationId_idx" ON "Coupon"("organizationId");

-- 4. CouponRedemption
ALTER TABLE "CouponRedemption" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "CouponRedemption" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "CouponRedemption_organizationId_idx" ON "CouponRedemption"("organizationId");

-- 5. RefundRequest
ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "RefundRequest" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "RefundRequest_organizationId_idx" ON "RefundRequest"("organizationId");

-- 6. ZatcaSubmission
ALTER TABLE "ZatcaSubmission" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE "ZatcaSubmission" ALTER COLUMN "organizationId" DROP DEFAULT;
CREATE INDEX IF NOT EXISTS "ZatcaSubmission_organizationId_idx" ON "ZatcaSubmission"("organizationId");

-- 7. ZatcaConfig — singleton conversion.
-- Before: id @default("default") — one row with id='default'.
-- After: id uuid, organizationId @unique — one row per org.
-- Strategy: add organizationId column (NOT NULL), backfill existing "default" row to DEFAULT_ORG_ID,
-- then swap primary-key default from string "default" to uuid gen and enforce unique on organizationId.
ALTER TABLE "ZatcaConfig" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "ZatcaConfig" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
ALTER TABLE "ZatcaConfig" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ZatcaConfig_organizationId_key" ON "ZatcaConfig"("organizationId");
-- Change id default from "default" string to uuid. Existing id='default' row keeps that id value;
-- new rows get uuid. Prisma generate-time default is enforced at the app layer.
ALTER TABLE "ZatcaConfig" ALTER COLUMN "id" DROP DEFAULT;

-- 8. Row Level Security (RLS) — enable + policy on all 7 tables
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Coupon" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CouponRedemption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RefundRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ZatcaSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ZatcaConfig" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "Invoice" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Payment" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "Coupon" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "CouponRedemption" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "RefundRequest" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ZatcaSubmission" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "ZatcaConfig" USING ("organizationId" = current_setting('app.current_organization_id', true));
