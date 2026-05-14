ALTER TABLE "Subscription"
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scheduledCancellationDate" TIMESTAMP(3);

CREATE INDEX "Subscription_cancelAtPeriodEnd_scheduledCancellationDate_idx"
  ON "Subscription"("cancelAtPeriodEnd", "scheduledCancellationDate");
