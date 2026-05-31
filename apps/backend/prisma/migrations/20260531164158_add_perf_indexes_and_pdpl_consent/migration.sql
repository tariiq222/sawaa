-- AlterTable: PDPL consent capture on Client (nullable — legacy/walk-in predate consent)
ALTER TABLE "Client" ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "consentedAt" TIMESTAMP(3);

-- CreateIndex: missing FK / reporting indexes (perf hardening)
CREATE INDEX "Invoice_employeeId_idx" ON "Invoice"("employeeId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RefundRequest_paymentId_idx" ON "RefundRequest"("paymentId");
