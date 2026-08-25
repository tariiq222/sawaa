-- Task 6 review round 2: conservative Moyasar reconciliation and monotonic
-- Zoom desired state. Existing columns and enum values remain intact.

ALTER TYPE "RefundStatus" ADD VALUE IF NOT EXISTS 'MANUAL_REVIEW';
ALTER TYPE "RefundProviderState" ADD VALUE IF NOT EXISTS 'BEFORE_CALL';
ALTER TYPE "RefundProviderState" ADD VALUE IF NOT EXISTS 'MANUAL_REVIEW';

ALTER TABLE "RefundRequest"
  ADD COLUMN "providerLeaseOwner" TEXT,
  ADD COLUMN "providerLeaseExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "baselineRefundedAmount" DECIMAL(12,2),
  ADD COLUMN "targetCumulativeRefundedAmount" DECIMAL(12,2),
  ADD COLUMN "observedCumulativeRefundedAmount" DECIMAL(12,2);

ALTER TABLE "RefundRequest"
  ALTER COLUMN "providerState" SET DEFAULT 'BEFORE_CALL';

UPDATE "RefundRequest"
SET "providerState" = 'BEFORE_CALL'
WHERE "providerState" = 'NOT_CALLED';

CREATE INDEX "RefundRequest_status_providerLeaseExpiresAt_idx"
  ON "RefundRequest"("status", "providerLeaseExpiresAt");

ALTER TABLE "Booking"
  ADD COLUMN "zoomCreatePhase" TEXT NOT NULL DEFAULT 'BEFORE_CALL',
  ADD COLUMN "zoomCreateLeaseOwner" TEXT,
  ADD COLUMN "zoomCreateLeaseExpiresAt" TIMESTAMPTZ(3),
  ADD COLUMN "zoomCreateAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "zoomSyncRevision" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "zoomSyncLeaseOwner" TEXT,
  ADD COLUMN "zoomSyncLeaseExpiresAt" TIMESTAMPTZ(3);

ALTER TABLE "BookingZoomSync"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "BookingZoomSync_bookingId_revision_idx"
  ON "BookingZoomSync"("bookingId", "revision");

CREATE UNIQUE INDEX "BookingZoomSync_bookingId_revision_positive_key"
  ON "BookingZoomSync"("bookingId", "revision")
  WHERE "revision" > 0;

CREATE INDEX "Booking_zoomMeetingStatus_zoomCreateLeaseExpiresAt_idx"
  ON "Booking"("zoomMeetingStatus", "zoomCreateLeaseExpiresAt");
