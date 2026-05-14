-- Per-tenant Moyasar credentials.
-- Tenant uses their own Moyasar account to collect booking-payment revenue.
-- Platform Moyasar (apps/backend/src/modules/platform/billing/) is a separate
-- account that collects subscription fees from tenants. See memory
-- saas_moyasar_architecture for the TWO-Moyasar design.

-- CreateTable
CREATE TABLE "OrganizationPaymentConfig" (
  "id"                 TEXT          NOT NULL,
  "organizationId"     TEXT          NOT NULL,
  "publishableKey"     TEXT          NOT NULL,
  "secretKeyEnc"       TEXT          NOT NULL,
  "webhookSecretEnc"   TEXT,
  "isLive"             BOOLEAN       NOT NULL DEFAULT false,
  "lastVerifiedAt"     TIMESTAMP(3),
  "lastVerifiedStatus" TEXT,
  "createdAt"          TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)  NOT NULL,

  CONSTRAINT "OrganizationPaymentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPaymentConfig_organizationId_key" ON "OrganizationPaymentConfig"("organizationId");

-- AddForeignKey
ALTER TABLE "OrganizationPaymentConfig"
  ADD CONSTRAINT "OrganizationPaymentConfig_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Row-level security ─────────────────────────────────────────────────────
ALTER TABLE "OrganizationPaymentConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationPaymentConfig" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_organization_payment_config
  ON "OrganizationPaymentConfig"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- Grant SELECT to the rls_probe role so penetration tests can verify isolation.
GRANT SELECT ON "OrganizationPaymentConfig" TO carekit_rls_probe;
