CREATE TYPE "NotificationSenderActor" AS ENUM ('PLATFORM', 'TENANT', 'PLATFORM_FALLBACK');
ALTER TABLE "NotificationDeliveryLog" ADD COLUMN "senderActor" "NotificationSenderActor" NOT NULL DEFAULT 'TENANT';
