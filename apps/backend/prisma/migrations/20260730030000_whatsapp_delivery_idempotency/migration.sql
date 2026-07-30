CREATE TYPE "WhatsappDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TABLE "WhatsappMessage"
ADD COLUMN "inReplyToExternalMessageId" TEXT,
ADD COLUMN "deliveryStatus" "WhatsappDeliveryStatus",
ADD COLUMN "providerMessageId" TEXT;

CREATE UNIQUE INDEX "WhatsappMessage_inReplyToExternalMessageId_key"
ON "WhatsappMessage"("inReplyToExternalMessageId");
