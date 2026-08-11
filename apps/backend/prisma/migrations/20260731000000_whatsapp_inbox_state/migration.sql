ALTER TYPE "ClientSource" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'WHATSAPP';

ALTER TABLE "WhatsappConversation"
  ADD COLUMN "contactName" TEXT,
  ADD COLUMN "unreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastInboundAt" TIMESTAMP(3),
  ADD COLUMN "lastReadAt" TIMESTAMP(3);

ALTER TABLE "WhatsappMessage"
  ADD COLUMN "readAt" TIMESTAMP(3);

CREATE INDEX "WhatsappConversation_staffTakeover_lastMessageAt_idx"
  ON "WhatsappConversation"("staffTakeover", "lastMessageAt" DESC);

CREATE INDEX "WhatsappConversation_unreadCount_lastMessageAt_idx"
  ON "WhatsappConversation"("unreadCount", "lastMessageAt" DESC);

CREATE INDEX "WhatsappMessage_conversationId_createdAt_role_readAt_idx"
  ON "WhatsappMessage"("conversationId", "createdAt" DESC, "role", "readAt");
