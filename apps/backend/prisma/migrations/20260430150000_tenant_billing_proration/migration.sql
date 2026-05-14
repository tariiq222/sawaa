ALTER TABLE "Subscription"
  ADD COLUMN "scheduledPlanId" TEXT,
  ADD COLUMN "scheduledBillingCycle" "BillingCycle",
  ADD COLUMN "scheduledPlanChangeAt" TIMESTAMP(3);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_scheduledPlanId_fkey"
  FOREIGN KEY ("scheduledPlanId")
  REFERENCES "Plan"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "Subscription_scheduledPlanChangeAt_idx"
  ON "Subscription"("scheduledPlanChangeAt");
