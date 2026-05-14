-- Migration: TASK-DB-03 Class B — intra-finance FKs
-- RefundRequest.invoiceId → Invoice (RESTRICT: never silently delete an invoice under a refund)
-- RefundRequest.paymentId → Payment (RESTRICT: same rationale — financial audit record)
--
-- Zero orphans in dev DB confirmed before adding these constraints (audit run 2026-05-02).
-- NOTE: If running against a test DB with stale test data, orphans are archived first.

-- 1. Archive orphaned RefundRequest rows (orphans from test fixtures — not real finance data).
--    Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent if re-run.
CREATE TABLE IF NOT EXISTS "_orphaned_refund_request_20260502" (LIKE "RefundRequest" INCLUDING ALL);

INSERT INTO "_orphaned_refund_request_20260502"
SELECT * FROM "RefundRequest"
WHERE NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = "RefundRequest"."invoiceId")
   OR NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p.id = "RefundRequest"."paymentId")
ON CONFLICT DO NOTHING;

DELETE FROM "RefundRequest"
WHERE NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i.id = "RefundRequest"."invoiceId")
   OR NOT EXISTS (SELECT 1 FROM "Payment" p WHERE p.id = "RefundRequest"."paymentId");

-- 2. RefundRequest.invoiceId → Invoice (ON DELETE RESTRICT)
ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_invoiceId_fkey"
  FOREIGN KEY ("invoiceId")
  REFERENCES "Invoice"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- 3. RefundRequest.paymentId → Payment (ON DELETE RESTRICT)
ALTER TABLE "RefundRequest"
  ADD CONSTRAINT "RefundRequest_paymentId_fkey"
  FOREIGN KEY ("paymentId")
  REFERENCES "Payment"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
