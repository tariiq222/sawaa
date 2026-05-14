ALTER TABLE "Subscription"
  ADD COLUMN "dunningRetryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "nextRetryAt" TIMESTAMP(3);

CREATE TABLE "DunningLog" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "moyasarPaymentId" TEXT,
  "failureReason" TEXT,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DunningLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Subscription_nextRetryAt_idx" ON "Subscription"("nextRetryAt");
CREATE INDEX "DunningLog_organizationId_idx" ON "DunningLog"("organizationId");
CREATE INDEX "DunningLog_subscriptionId_idx" ON "DunningLog"("subscriptionId");
CREATE INDEX "DunningLog_invoiceId_idx" ON "DunningLog"("invoiceId");
CREATE UNIQUE INDEX "DunningLog_invoiceId_attemptNumber_key"
  ON "DunningLog"("invoiceId", "attemptNumber");

ALTER TABLE "DunningLog"
  ADD CONSTRAINT "DunningLog_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DunningLog"
  ADD CONSTRAINT "DunningLog_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "SubscriptionInvoice"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DunningLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DunningLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_dunning_log ON "DunningLog";
CREATE POLICY tenant_isolation_dunning_log ON "DunningLog"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
