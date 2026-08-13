-- A pre-payment-fence PROCESSING row may have been observed by an old worker
-- that cannot honor Payment.refundProviderLease. Do not automatically call a
-- provider from any such migration survivor; an operator reconciles it.
UPDATE "RefundRequest"
SET status = 'MANUAL_REVIEW',
    "providerState" = 'MANUAL_REVIEW',
    "lastProviderError" = 'Pre-payment-fence refund quarantined during rolling upgrade; manual reconciliation required'
WHERE status = 'PROCESSING';

-- Preserve the publisher compatibility lane through FAILED/retry. A legacy
-- publisher only polls PENDING, therefore a PENDING_V2 event must never be
-- reset to PENDING by admin retry.
ALTER TABLE "OutboxEvent"
  ADD COLUMN "deliveryLane" TEXT NOT NULL DEFAULT 'PENDING';

UPDATE "OutboxEvent"
SET "deliveryLane" = 'PENDING_V2'
WHERE status = 'PENDING_V2';
