-- Migration: add_refund_usage_revert_log
-- Phase 2 / Bug B11 — refund must decrement UsageCounter.
-- The DecrementOnRefundListener writes one row per (refundRequestId, metric)
-- as it decrements the counter, so re-firing the RefundCompletedEvent does
-- NOT double-decrement (the unique index throws on replay).

CREATE TABLE "RefundUsageRevertLog" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId"  TEXT NOT NULL,
    "refundRequestId" TEXT NOT NULL,
    "metric"          TEXT NOT NULL,
    "amount"          INTEGER NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundUsageRevertLog_pkey" PRIMARY KEY ("id")
);

-- Idempotency guard: one row per (refundRequestId, metric).
CREATE UNIQUE INDEX "RefundUsageRevertLog_refundRequestId_metric_key"
    ON "RefundUsageRevertLog"("refundRequestId", "metric");

CREATE INDEX "RefundUsageRevertLog_organizationId_idx"
    ON "RefundUsageRevertLog"("organizationId");

CREATE INDEX "RefundUsageRevertLog_refundRequestId_idx"
    ON "RefundUsageRevertLog"("refundRequestId");
