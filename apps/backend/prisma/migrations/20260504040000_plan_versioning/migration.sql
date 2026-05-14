-- Migration: plan_versioning
-- Adds PlanVersion table and Subscription.planVersionId for grandfathering subscriptions
-- at the pricing/limits snapshot that was active when they signed up or changed plans.

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "priceMonthly" DECIMAL(12,2) NOT NULL,
    "priceAnnual" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "limits" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanVersion_planId_idx" ON "PlanVersion"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "planVersionId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_planVersionId_idx" ON "Subscription"("planVersionId");

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing Plan gets version 1 from current state.
INSERT INTO "PlanVersion" (id, "planId", version, "priceMonthly", "priceAnnual", currency, limits, "createdAt")
SELECT gen_random_uuid(), id, 1, "priceMonthly", "priceAnnual", currency, limits, NOW()
FROM "Plan";

-- Backfill: every Subscription points to its plan's version 1.
UPDATE "Subscription" s
SET "planVersionId" = pv.id
FROM "PlanVersion" pv
WHERE pv."planId" = s."planId" AND pv.version = 1;

-- Verification: every subscription must have a planVersionId.
DO $$
DECLARE missing_count INT;
BEGIN
  SELECT COUNT(*) INTO missing_count FROM "Subscription" WHERE "planVersionId" IS NULL;
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % subscriptions missing planVersionId', missing_count;
  END IF;
END $$;
