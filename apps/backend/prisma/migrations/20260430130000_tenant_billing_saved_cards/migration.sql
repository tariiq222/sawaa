ALTER TABLE "Subscription" ADD COLUMN "defaultSavedCardId" TEXT;

CREATE TABLE "SavedCard" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "moyasarTokenId" TEXT NOT NULL,
  "last4" TEXT NOT NULL,
  "brand" TEXT NOT NULL,
  "expiryMonth" INTEGER NOT NULL,
  "expiryYear" INTEGER NOT NULL,
  "holderName" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedCard_moyasarTokenId_key" ON "SavedCard"("moyasarTokenId");
CREATE INDEX "SavedCard_organizationId_idx" ON "SavedCard"("organizationId");
CREATE INDEX "SavedCard_organizationId_isDefault_idx" ON "SavedCard"("organizationId", "isDefault");
CREATE UNIQUE INDEX "SavedCard_one_default_per_org_idx"
  ON "SavedCard"("organizationId")
  WHERE "isDefault" = true;

ALTER TABLE "SavedCard"
  ADD CONSTRAINT "SavedCard_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_defaultSavedCardId_fkey"
  FOREIGN KEY ("defaultSavedCardId") REFERENCES "SavedCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionInvoice" ADD COLUMN "savedCardId" TEXT;
ALTER TABLE "SubscriptionInvoice"
  ADD CONSTRAINT "SubscriptionInvoice_savedCardId_fkey"
  FOREIGN KEY ("savedCardId") REFERENCES "SavedCard"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SavedCard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedCard" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_saved_card ON "SavedCard";
CREATE POLICY tenant_isolation_saved_card ON "SavedCard"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
