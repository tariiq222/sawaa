-- SaaS-02g-sms: per-tenant SMS provider refactor.

CREATE TYPE "SmsProvider" AS ENUM ('NONE', 'UNIFONIC', 'TAQNYAT');
CREATE TYPE "SmsDeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'UNKNOWN');

CREATE TABLE "OrganizationSmsConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "SmsProvider" NOT NULL DEFAULT 'NONE',
    "senderId" TEXT,
    "credentialsCiphertext" TEXT,
    "webhookSecret" TEXT,
    "lastTestAt" TIMESTAMP(3),
    "lastTestOk" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSmsConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSmsConfig_organizationId_key" ON "OrganizationSmsConfig"("organizationId");
CREATE INDEX "OrganizationSmsConfig_organizationId_idx" ON "OrganizationSmsConfig"("organizationId");

CREATE TABLE "SmsDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "SmsProvider" NOT NULL,
    "toPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "status" "SmsDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsDelivery_providerMessageId_key" ON "SmsDelivery"("providerMessageId");
CREATE INDEX "SmsDelivery_organizationId_idx" ON "SmsDelivery"("organizationId");
CREATE INDEX "SmsDelivery_status_idx" ON "SmsDelivery"("status");
CREATE INDEX "SmsDelivery_createdAt_idx" ON "SmsDelivery"("createdAt");

-- Seed one NONE-provider row for every existing org so send-sms has a config to fall back to.
INSERT INTO "OrganizationSmsConfig" ("id", "organizationId", "provider", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", 'NONE', NOW(), NOW() FROM "Organization";

-- RLS
ALTER TABLE "OrganizationSmsConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SmsDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "OrganizationSmsConfig" USING ("organizationId" = current_setting('app.current_organization_id', true));
CREATE POLICY "tenant_isolation" ON "SmsDelivery" USING ("organizationId" = current_setting('app.current_organization_id', true));
