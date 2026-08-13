-- Durable recovery for confirmed chat appointment mutations.
ALTER TYPE "ChatOperationType" ADD VALUE IF NOT EXISTS 'LIST_OWN_APPOINTMENTS';

ALTER TABLE "ChatOperation"
  ADD COLUMN "resultMessageId" TEXT;

ALTER TABLE "BookingStatusLog"
  ADD COLUMN "sourceActionId" TEXT,
  ADD COLUMN "sourceActionHash" TEXT,
  ADD COLUMN "sourceActionResult" JSONB;

CREATE UNIQUE INDEX "ChatOperation_resultMessageId_key"
  ON "ChatOperation"("resultMessageId");

CREATE UNIQUE INDEX "BookingStatusLog_sourceActionId_key"
  ON "BookingStatusLog"("sourceActionId");
