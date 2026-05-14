-- Migration: add_platform_mail_delivery_log
-- Phase 1 / Bug B6: Resilient platform email queue with retries.
-- Platform-scoped audit log (no organizationId) for every Resend dispatch
-- originating from PlatformMailerService.

CREATE TABLE "PlatformMailDeliveryLog" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "recipient"    TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "attempt"      INTEGER NOT NULL DEFAULT 0,
    "status"       TEXT NOT NULL,
    "errorMessage" TEXT,
    "jobId"        TEXT,
    "sentAt"       TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformMailDeliveryLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlatformMailDeliveryLog_status_createdAt_idx"
    ON "PlatformMailDeliveryLog"("status", "createdAt");

CREATE INDEX "PlatformMailDeliveryLog_recipient_idx"
    ON "PlatformMailDeliveryLog"("recipient");

CREATE INDEX "PlatformMailDeliveryLog_templateName_idx"
    ON "PlatformMailDeliveryLog"("templateName");
