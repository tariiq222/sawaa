-- Migration: add_webhook_event_idempotency
-- Bug B1 (pre-launch audit): Platform-level webhook dedup table.
-- Used by MoyasarSubscriptionWebhookHandler (and future webhook providers)
-- to ensure each (provider, eventId) pair is only processed once even when
-- Moyasar redelivers on receipt failure.
--
-- Intentionally NOT in SCOPED_MODELS — webhook events belong to Deqah, not a tenant.

CREATE TABLE "WebhookEvent" (
    "id"          TEXT NOT NULL,
    "provider"    TEXT NOT NULL,
    "eventId"     TEXT NOT NULL,
    "eventType"   TEXT NOT NULL,
    "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "result"      TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Composite uniqueness: same eventId can never be processed twice for the same provider.
CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key"
    ON "WebhookEvent"("provider", "eventId");

-- Operational index: scan recent events / enable retention sweep.
CREATE INDEX "WebhookEvent_receivedAt_idx"
    ON "WebhookEvent"("receivedAt");
