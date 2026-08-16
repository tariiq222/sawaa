-- Extend the existing Comms chat record into the unified web AI conversation.
-- Legacy WhatsApp and AI chat tables remain untouched during this rollout.

-- Rebuild ConversationStatus so legacy OPEN rows can become STAFF_ACTIVE in
-- the same migration. PostgreSQL does not permit using an enum value added in
-- the current transaction, so ALTER TYPE ... ADD VALUE cannot safely perform
-- this data transition here.
ALTER TYPE "ConversationStatus" RENAME TO "ConversationStatus_legacy";
CREATE TYPE "ConversationStatus" AS ENUM (
  'OPEN',
  'AI_ACTIVE',
  'WAITING_FOR_STAFF',
  'STAFF_ACTIVE',
  'CLOSED'
);
ALTER TABLE "ChatConversation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ChatConversation"
  ALTER COLUMN "status" TYPE "ConversationStatus"
  USING (
    CASE WHEN "status"::TEXT = 'OPEN' THEN 'STAFF_ACTIVE' ELSE "status"::TEXT END
  )::"ConversationStatus";
ALTER TABLE "ChatConversation"
  ALTER COLUMN "status" SET DEFAULT 'AI_ACTIVE';
DROP TYPE "ConversationStatus_legacy";

-- AlterEnum
ALTER TYPE "MessageSenderType" ADD VALUE IF NOT EXISTS 'VISITOR';
ALTER TYPE "MessageSenderType" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "MessageSenderType" ADD VALUE IF NOT EXISTS 'SYSTEM';

ALTER TYPE "BookingSource" ADD VALUE IF NOT EXISTS 'AI_CHAT';

-- CreateEnum
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'ACTION_CARD', 'OPERATION_RESULT', 'SYSTEM_EVENT');
CREATE TYPE "ChatOperationType" AS ENUM ('CREATE_BOOKING', 'RESCHEDULE_BOOKING', 'CANCEL_BOOKING');
CREATE TYPE "ChatOperationStatus" AS ENUM (
  'AWAITING_AUTH',
  'AWAITING_EXISTING_BOOKING_ACK',
  'AWAITING_CONFIRMATION',
  'EXECUTING',
  'SUCCEEDED',
  'FAILED',
  'DECLINED',
  'EXPIRED'
);

-- AlterTable
ALTER TABLE "ChatConversation"
  ALTER COLUMN "clientId" DROP NOT NULL,
  ADD COLUMN "guestTokenHash" TEXT,
  ADD COLUMN "guestName" TEXT,
  ADD COLUMN "guestPhone" TEXT,
  ADD COLUMN "language" TEXT NOT NULL DEFAULT 'ar',
  ADD COLUMN "assignedStaffUserId" TEXT,
  ADD COLUMN "handoffRequestedAt" TIMESTAMP(3),
  ADD COLUMN "staffClaimedAt" TIMESTAMP(3),
  ADD COLUMN "closedAt" TIMESTAMP(3),
  ADD COLUMN "staffUnreadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clientUnreadCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CommsChatMessage"
  ADD COLUMN "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT',
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "clientMessageId" TEXT,
  ADD COLUMN "responseForMessageId" TEXT,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "tokensUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "latencyMs" INTEGER,
  ADD COLUMN "readAt" TIMESTAMP(3);

ALTER TABLE "Booking"
  ADD COLUMN "creationIdempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "ChatOperation" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "clientId" TEXT,
  "type" "ChatOperationType" NOT NULL,
  "status" "ChatOperationStatus" NOT NULL,
  "payload" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requiredConfirmations" INTEGER NOT NULL,
  "confirmationCount" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "confirmedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "bookingId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatConversation_guestTokenHash_key" ON "ChatConversation"("guestTokenHash");
CREATE INDEX "ChatConversation_assignedStaffUserId_status_lastMessageAt_idx"
  ON "ChatConversation"("assignedStaffUserId", "status", "lastMessageAt");
CREATE UNIQUE INDEX "CommsChatMessage_conversationId_clientMessageId_key"
  ON "CommsChatMessage"("conversationId", "clientMessageId");
CREATE UNIQUE INDEX "CommsChatMessage_responseForMessageId_key"
  ON "CommsChatMessage"("responseForMessageId");
CREATE UNIQUE INDEX "Booking_creationIdempotencyKey_key" ON "Booking"("creationIdempotencyKey");
CREATE UNIQUE INDEX "ChatOperation_idempotencyKey_key" ON "ChatOperation"("idempotencyKey");
CREATE INDEX "ChatOperation_conversationId_status_createdAt_idx"
  ON "ChatOperation"("conversationId", "status", "createdAt");
CREATE INDEX "ChatOperation_clientId_status_createdAt_idx"
  ON "ChatOperation"("clientId", "status", "createdAt");
CREATE INDEX "ChatOperation_expiresAt_idx" ON "ChatOperation"("expiresAt");
CREATE INDEX "ChatOperation_bookingId_idx" ON "ChatOperation"("bookingId");

-- AddForeignKey
ALTER TABLE "ChatOperation"
  ADD CONSTRAINT "ChatOperation_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "ChatConversation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
