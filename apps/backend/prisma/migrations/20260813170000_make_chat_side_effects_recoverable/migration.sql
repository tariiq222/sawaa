-- Task 6 review hardening: durable request identity and recoverable external
-- side effects. All changes are additive; existing rows remain valid.

ALTER TABLE "Booking"
  ADD COLUMN "creationRequestHash" TEXT;

CREATE TYPE "RefundProviderState" AS ENUM (
  'NOT_CALLED',
  'CALL_UNKNOWN',
  'CONFIRMED',
  'FAILED'
);

ALTER TABLE "RefundRequest"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "sourceEventId" UUID,
  ADD COLUMN "providerState" "RefundProviderState" NOT NULL DEFAULT 'NOT_CALLED',
  ADD COLUMN "providerAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastProviderAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "lastProviderError" TEXT;

UPDATE "RefundRequest"
SET "idempotencyKey" = 'refund:' || id
WHERE "idempotencyKey" IS NULL;

UPDATE "RefundRequest"
SET "providerState" = CASE
  WHEN status = 'COMPLETED' THEN 'CONFIRMED'::"RefundProviderState"
  WHEN status = 'FAILED' THEN 'FAILED'::"RefundProviderState"
  WHEN "gatewayRef" IS NOT NULL THEN 'CONFIRMED'::"RefundProviderState"
  WHEN status = 'PROCESSING' THEN 'CALL_UNKNOWN'::"RefundProviderState"
  ELSE 'NOT_CALLED'::"RefundProviderState"
END;

CREATE UNIQUE INDEX "RefundRequest_idempotencyKey_key"
  ON "RefundRequest"("idempotencyKey");
CREATE UNIQUE INDEX "RefundRequest_sourceEventId_key"
  ON "RefundRequest"("sourceEventId");
CREATE INDEX "RefundRequest_status_updatedAt_idx"
  ON "RefundRequest"("status", "updatedAt");

ALTER TABLE "ChatOperation"
  ADD COLUMN "authResumedAt" TIMESTAMP(3),
  ADD COLUMN "authResumeMessageId" TEXT,
  ADD COLUMN "resumedFromOperationId" TEXT,
  ADD COLUMN "resumedOperationId" TEXT;

CREATE UNIQUE INDEX "ChatOperation_authResumeMessageId_key"
  ON "ChatOperation"("authResumeMessageId");
CREATE UNIQUE INDEX "ChatOperation_resumedFromOperationId_key"
  ON "ChatOperation"("resumedFromOperationId");
CREATE UNIQUE INDEX "ChatOperation_resumedOperationId_key"
  ON "ChatOperation"("resumedOperationId");

CREATE TABLE "BookingZoomSync" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "bookingId" TEXT NOT NULL,
  "sourceActionId" TEXT NOT NULL,
  "zoomMeetingId" TEXT NOT NULL,
  "desiredTopic" TEXT NOT NULL,
  "desiredStartAt" TIMESTAMPTZ(3) NOT NULL,
  "desiredDurationMins" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "BookingZoomSync_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingZoomSync_eventId_key" ON "BookingZoomSync"("eventId");
CREATE UNIQUE INDEX "BookingZoomSync_sourceActionId_key" ON "BookingZoomSync"("sourceActionId");
CREATE INDEX "BookingZoomSync_bookingId_idx" ON "BookingZoomSync"("bookingId");
CREATE INDEX "BookingZoomSync_status_updatedAt_idx" ON "BookingZoomSync"("status", "updatedAt");
