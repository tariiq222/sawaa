-- Add PLATFORM_SETTING_UPDATED to SuperAdminActionType
ALTER TYPE "SuperAdminActionType" ADD VALUE IF NOT EXISTS 'PLATFORM_SETTING_UPDATED';

-- PlatformEmailTemplate
CREATE TABLE "PlatformEmailTemplate" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "subjectAr"   TEXT NOT NULL,
  "subjectEn"   TEXT NOT NULL,
  "htmlBody"    TEXT NOT NULL,
  "blocks"      JSONB,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isLocked"    BOOLEAN NOT NULL DEFAULT false,
  "version"     INTEGER NOT NULL DEFAULT 1,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlatformEmailTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformEmailTemplate_slug_key" ON "PlatformEmailTemplate"("slug");

-- PlatformEmailLogStatus enum
CREATE TYPE "PlatformEmailLogStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED_NOT_CONFIGURED');

-- PlatformEmailLog
CREATE TABLE "PlatformEmailLog" (
  "id"                TEXT NOT NULL,
  "organizationId"    TEXT,
  "templateSlug"      TEXT NOT NULL,
  "toAddress"         TEXT NOT NULL,
  "status"            "PlatformEmailLogStatus" NOT NULL DEFAULT 'QUEUED',
  "providerMessageId" TEXT,
  "errorMessage"      TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt"            TIMESTAMP(3),
  CONSTRAINT "PlatformEmailLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformEmailLog_organizationId_idx" ON "PlatformEmailLog"("organizationId");
CREATE INDEX "PlatformEmailLog_templateSlug_idx" ON "PlatformEmailLog"("templateSlug");
CREATE INDEX "PlatformEmailLog_status_createdAt_idx" ON "PlatformEmailLog"("status", "createdAt");
