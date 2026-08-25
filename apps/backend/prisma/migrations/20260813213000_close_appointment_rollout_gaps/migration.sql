-- Payment-scoped provider fence: two distinct RefundRequest rows must never
-- perform concurrent cumulative Moyasar refunds against the same payment.
ALTER TABLE "Payment"
  ADD COLUMN "refundProviderLeaseOwner" TEXT,
  ADD COLUMN "refundProviderLeaseExpiresAt" TIMESTAMPTZ(3);

CREATE INDEX "Payment_refundProviderLeaseExpiresAt_idx"
  ON "Payment"("refundProviderLeaseExpiresAt");

-- Existing duplicated in-flight rows cannot safely be attributed to a provider
-- cumulative total. Keep the newest lease candidate and send older ones to
-- operator review before adding the invariant (non-destructive recovery).
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY "paymentId" ORDER BY "createdAt" DESC, id DESC) AS rank
  FROM "RefundRequest"
  WHERE status = 'PROCESSING'
)
UPDATE "RefundRequest" rr
SET status = 'MANUAL_REVIEW',
    "providerState" = 'MANUAL_REVIEW',
    "lastProviderError" = 'Multiple pre-fence processing refunds require manual reconciliation'
FROM ranked
WHERE rr.id = ranked.id AND ranked.rank > 1;

-- An in-flight request is an additional database backstop to the Payment
-- FOR UPDATE in createRefundRequestInTx.
CREATE UNIQUE INDEX "RefundRequest_one_processing_per_payment_key"
  ON "RefundRequest"("paymentId") WHERE "status" = 'PROCESSING';

-- The first rollout backfilled state as BEFORE_CALL. Rows that already have a
-- confirmed remote meeting are complete facts, not permission to issue POST.
UPDATE "Booking"
SET "zoomCreatePhase" = 'COMPLETED'
WHERE "zoomMeetingId" IS NOT NULL
  AND "zoomMeetingStatus" = 'CREATED'
  AND "zoomCreatePhase" <> 'COMPLETED';
