-- Additive nullable facts only; no history is rewritten.
ALTER TABLE "Booking" ADD COLUMN "lateEntryRecordedAt" TIMESTAMP(3), ADD COLUMN "lateEntryRecordedBy" TEXT;
ALTER TABLE "Payment" ADD COLUMN "effectiveReceivedAt" TIMESTAMP(3), ADD COLUMN "receiptRecordedBy" TEXT,
  ADD COLUMN "receiptEvidenceRef" TEXT, ADD COLUMN "receiptEntryReason" TEXT;
