-- Tenant Billing Suite Phase 1: trial lifecycle fields on Subscription.
ALTER TABLE "Subscription" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "trialExtendedBy" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Subscription" ADD COLUMN "trialExtendedById" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "trialExtendedAt" TIMESTAMP(3);

-- Existing trial subscriptions predate the explicit start timestamp.
UPDATE "Subscription"
SET "trialStartedAt" = "createdAt"
WHERE "trialStartedAt" IS NULL
  AND "status" = 'TRIALING';
