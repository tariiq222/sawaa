-- Additive only: a new append-only ledger beside PackagePurchase's cumulative
-- refund fields, which are left exactly as they are. Nothing reads from this
-- table yet, so applying this migration changes no existing behaviour.

-- CreateEnum
CREATE TYPE "PackageRefundEventSource" AS ENUM ('LIVE', 'LEGACY_REQUEST', 'LEGACY_AGGREGATE');

-- CreateEnum
CREATE TYPE "PackageRefundType" AS ENUM ('FULL', 'PARTIAL', 'UNKNOWN');

-- CreateTable
CREATE TABLE "PackageRefundEvent" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "cumulativeRefundAmount" DECIMAL(12,2),
    "source" "PackageRefundEventSource" NOT NULL,
    "refundType" "PackageRefundType" NOT NULL,
    "occurredAt" TIMESTAMPTZ(3),
    "notes" TEXT,
    "processedBy" TEXT,
    "sourceRefundRequestId" TEXT,
    "legacyAggregateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageRefundEvent_pkey" PRIMARY KEY ("id")
);

-- Idempotency keys for the historical transition. Both stay nullable: a live
-- event has neither, and Postgres treats NULLs as distinct in a unique index,
-- so many live rows coexist while a replayed import cannot duplicate one.
-- CreateIndex
CREATE UNIQUE INDEX "PackageRefundEvent_sourceRefundRequestId_key" ON "PackageRefundEvent"("sourceRefundRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageRefundEvent_legacyAggregateKey_key" ON "PackageRefundEvent"("legacyAggregateKey");

-- CreateIndex
CREATE INDEX "PackageRefundEvent_purchaseId_occurredAt_idx" ON "PackageRefundEvent"("purchaseId", "occurredAt");

-- CreateIndex
CREATE INDEX "PackageRefundEvent_occurredAt_idx" ON "PackageRefundEvent"("occurredAt");
