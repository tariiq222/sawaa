-- Harden OrganizationPaymentConfig into a true DB-enforced singleton.
--
-- Single-tenant: there must be exactly one payment-config row. Until now the
-- "singleton" was only a convention (findFirst + orderBy updatedAt desc), which
-- leaves a race: two concurrent upserts both read null and create two rows with
-- divergent secrets, after which a webhook may verify against the wrong row.
--
-- 1. Collapse any existing duplicates down to the most-recently-updated row.
-- 2. Add a constant singletonKey column with a UNIQUE constraint so the DB
--    rejects a second row outright. Reads become findUnique, writes upsert.

-- 1. Delete all but the newest row (defensive — single-tenant should have ≤1).
--    Tie-break on id so two rows sharing an identical updatedAt still collapse
--    to exactly one survivor — otherwise neither is deleted and the UNIQUE
--    index below fails, rolling back the migration.
DELETE FROM "OrganizationPaymentConfig" a
USING "OrganizationPaymentConfig" b
WHERE (a."updatedAt", a."id") < (b."updatedAt", b."id");

-- 2. Add the constant key column, backfill the surviving row, enforce uniqueness.
ALTER TABLE "OrganizationPaymentConfig"
  ADD COLUMN "singletonKey" TEXT NOT NULL DEFAULT 'singleton';

CREATE UNIQUE INDEX "OrganizationPaymentConfig_singletonKey_key"
  ON "OrganizationPaymentConfig" ("singletonKey");
