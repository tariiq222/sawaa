CREATE TYPE "NotificationIntentStatus" AS ENUM ('PENDING', 'MATERIALIZED', 'RETRY_WAIT', 'DEAD', 'EXPIRED');
CREATE TYPE "NotificationOutboxDeliveryStatus" AS ENUM ('READY', 'SENDING', 'RETRY_WAIT', 'ACCEPTED', 'DELIVERED', 'SKIPPED', 'EXPIRED', 'DEAD', 'UNKNOWN');
CREATE TYPE "NotificationDeliveryAttemptOutcome" AS ENUM ('STARTED', 'ACCEPTED', 'DELIVERED', 'RETRY_WAIT', 'SKIPPED', 'EXPIRED', 'DEAD', 'UNKNOWN');

CREATE TABLE "NotificationIntent" (
  "id" UUID NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "consumerKey" TEXT NOT NULL,
  "sourceOutboxId" UUID,
  "payloadVersion" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" "NotificationIntentStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3),
  "leaseToken" UUID,
  "leaseUntil" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "intentId" UUID NOT NULL,
  "recipientType" "RecipientType" NOT NULL,
  "recipientId" TEXT NOT NULL,
  "channel" "DeliveryChannel" NOT NULL,
  "targetKey" TEXT NOT NULL,
  "notificationId" TEXT,
  "deliveryLogId" TEXT,
  "channelPayload" JSONB NOT NULL,
  "status" "NotificationOutboxDeliveryStatus" NOT NULL DEFAULT 'READY',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3),
  "nextEnqueueAt" TIMESTAMPTZ(3),
  "enqueueGeneration" INTEGER NOT NULL DEFAULT 0,
  "leaseToken" UUID,
  "leaseUntil" TIMESTAMPTZ(3),
  "providerName" TEXT,
  "providerMessageId" TEXT,
  "acceptedAt" TIMESTAMPTZ(3),
  "deliveredAt" TIMESTAMPTZ(3),
  "outcomeReason" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDeliveryAttempt" (
  "id" UUID NOT NULL,
  "deliveryId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "leaseToken" UUID NOT NULL,
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  "outcome" "NotificationDeliveryAttemptOutcome" NOT NULL DEFAULT 'STARTED',
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationIntent_sourceKey_consumerKey_key" ON "NotificationIntent"("sourceKey", "consumerKey");
CREATE INDEX "NotificationIntent_sourceOutboxId_idx" ON "NotificationIntent"("sourceOutboxId");
CREATE INDEX "NotificationIntent_status_nextAttemptAt_id_idx" ON "NotificationIntent"("status", "nextAttemptAt", "id");
CREATE INDEX "NotificationIntent_status_leaseUntil_id_idx" ON "NotificationIntent"("status", "leaseUntil", "id");
CREATE UNIQUE INDEX "NotificationDelivery_deliveryLogId_key" ON "NotificationDelivery"("deliveryLogId");
CREATE UNIQUE INDEX "NotificationDelivery_intentId_recipientType_recipientId_channel_targetKey_key" ON "NotificationDelivery"("intentId", "recipientType", "recipientId", "channel", "targetKey");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_id_idx" ON "NotificationDelivery"("status", "nextAttemptAt", "id");
CREATE INDEX "NotificationDelivery_status_leaseUntil_id_idx" ON "NotificationDelivery"("status", "leaseUntil", "id");
CREATE INDEX "NotificationDelivery_status_nextEnqueueAt_id_idx" ON "NotificationDelivery"("status", "nextEnqueueAt", "id");
CREATE INDEX "NotificationDelivery_providerName_providerMessageId_idx" ON "NotificationDelivery"("providerName", "providerMessageId");
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_deliveryId_attemptNumber_key" ON "NotificationDeliveryAttempt"("deliveryId", "attemptNumber");
CREATE INDEX "NotificationDeliveryAttempt_deliveryId_startedAt_idx" ON "NotificationDeliveryAttempt"("deliveryId", "startedAt");

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "NotificationIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
