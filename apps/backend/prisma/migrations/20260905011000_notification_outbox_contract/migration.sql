ALTER TABLE "NotificationDelivery" ADD COLUMN "targetAddress" TEXT NOT NULL;

-- PostgreSQL truncated the original generated identifier to 63 bytes. Give the
-- durable delivery identity a stable explicit name that Prisma can introspect.
ALTER INDEX "NotificationDelivery_intentId_recipientType_recipientId_channel"
  RENAME TO "NotificationDelivery_dedup_key";
