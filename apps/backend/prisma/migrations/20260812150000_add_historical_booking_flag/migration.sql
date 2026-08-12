-- AddColumn
ALTER TABLE "Booking"
ADD COLUMN "isHistoricalImport" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Booking_historical_status_scheduled_idx"
ON "Booking"("isHistoricalImport", "status", "scheduledAt");
