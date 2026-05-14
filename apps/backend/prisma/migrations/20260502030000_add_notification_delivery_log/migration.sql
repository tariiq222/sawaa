-- Migration: add_notification_delivery_log
-- Creates 3 new ENUMs and the NotificationDeliveryLog table.
-- NotificationType already exists in DB — do NOT recreate it.

-- CreateEnum: DeliveryChannel
CREATE TYPE "DeliveryChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP');

-- CreateEnum: DeliveryStatus
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum: NotificationPriority
CREATE TYPE "NotificationPriority" AS ENUM ('CRITICAL', 'STANDARD');

-- CreateTable: NotificationDeliveryLog
CREATE TABLE "NotificationDeliveryLog" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientId"    TEXT NOT NULL,
    "type"           "NotificationType" NOT NULL,
    "priority"       "NotificationPriority" NOT NULL DEFAULT 'STANDARD',
    "channel"        "DeliveryChannel" NOT NULL,
    "status"         "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "toAddress"      TEXT,
    "providerName"   TEXT,
    "attempts"       INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt"  TIMESTAMP(3),
    "sentAt"         TIMESTAMP(3),
    "errorMessage"   TEXT,
    "jobId"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: organizationId
CREATE INDEX "NotificationDeliveryLog_organizationId_idx"
    ON "NotificationDeliveryLog"("organizationId");

-- CreateIndex: (organizationId, status)
CREATE INDEX "NotificationDeliveryLog_organizationId_status_idx"
    ON "NotificationDeliveryLog"("organizationId", "status");

-- CreateIndex: (organizationId, type)
CREATE INDEX "NotificationDeliveryLog_organizationId_type_idx"
    ON "NotificationDeliveryLog"("organizationId", "type");

-- CreateIndex: createdAt
CREATE INDEX "NotificationDeliveryLog_createdAt_idx"
    ON "NotificationDeliveryLog"("createdAt");
