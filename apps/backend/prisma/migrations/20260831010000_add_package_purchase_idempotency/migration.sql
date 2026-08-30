ALTER TABLE "PackagePurchase"
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "requestFingerprint" TEXT,
ADD COLUMN "creditSnapshot" JSONB;

CREATE UNIQUE INDEX "PackagePurchase_idempotencyKey_key"
ON "PackagePurchase"("idempotencyKey");

-- Only one modern (idempotency-keyed) online checkout may be pending for a
-- client/package pair. Existing PENDING rows predate these columns, so they all
-- have a NULL key. Excluding those rows keeps the migration deploy-safe when
-- historical duplicate PENDING purchases exist, preserves them as audit
-- history, and lets the application start one new keyed checkout. ACTIVE
-- purchases remain repeatable by design.
CREATE UNIQUE INDEX "PackagePurchase_one_pending_per_client_package_key"
ON "PackagePurchase"("clientId", "packageId")
WHERE "status" = 'PENDING' AND "idempotencyKey" IS NOT NULL;
