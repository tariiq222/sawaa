-- SaaS-email-provider: per-tenant email provider configuration
-- Mirrors OrganizationSmsConfig pattern with AES-256-GCM encrypted credentials.

CREATE TYPE "EmailProvider" AS ENUM ('NONE', 'SMTP', 'RESEND', 'SENDGRID', 'MAILCHIMP');

CREATE TABLE "OrganizationEmailConfig" (
    "id"                    TEXT NOT NULL,
    "organizationId"        TEXT NOT NULL,
    "provider"              "EmailProvider" NOT NULL DEFAULT 'NONE',
    "senderName"            TEXT,
    "senderEmail"           TEXT,
    "credentialsCiphertext" TEXT,
    "lastTestAt"            TIMESTAMP(3),
    "lastTestOk"            BOOLEAN,
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationEmailConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationEmailConfig_organizationId_key" ON "OrganizationEmailConfig"("organizationId");
CREATE INDEX "OrganizationEmailConfig_organizationId_idx" ON "OrganizationEmailConfig"("organizationId");
