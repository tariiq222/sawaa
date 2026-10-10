SET lock_timeout = '5s';

ALTER TABLE "Invoice"
  ADD COLUMN "receiptPdfKey" TEXT,
  ADD COLUMN "receiptIssuedAt" TIMESTAMP(3),
  ADD COLUMN "receiptPaymentId" TEXT;

RESET lock_timeout;
