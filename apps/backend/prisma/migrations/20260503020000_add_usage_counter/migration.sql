-- Migration: add_usage_counter
-- Phase 5: Materialize quota usage in UsageCounter table.
-- One row per (organizationId, featureKey, periodStart).
-- monthly_bookings resets each calendar month; other keys use EPOCH.

CREATE TABLE "UsageCounter" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "featureKey"     TEXT NOT NULL,
    "periodStart"    TIMESTAMP(3) NOT NULL,
    "value"          INTEGER NOT NULL DEFAULT 0,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageCounter_pkey" PRIMARY KEY ("id")
);

-- Indexes for efficient lookup
CREATE UNIQUE INDEX "UsageCounter_organizationId_featureKey_periodStart_key"
    ON "UsageCounter"("organizationId", "featureKey", "periodStart");

CREATE INDEX "UsageCounter_organizationId_idx"
    ON "UsageCounter"("organizationId");

CREATE INDEX "UsageCounter_featureKey_idx"
    ON "UsageCounter"("featureKey");

-- Foreign key to Organization (cascade delete when org is removed)
ALTER TABLE "UsageCounter"
    ADD CONSTRAINT "UsageCounter_organizationId_fkey"
    FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
