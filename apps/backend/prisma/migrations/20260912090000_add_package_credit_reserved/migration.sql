-- Additive: existing credits keep reservedQuantity = 0, so nothing to backfill.
ALTER TABLE "PackageCredit" ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0;

-- Postgres adds an enum value without rewriting existing rows. This statement
-- is alone in its own migration on purpose: a value added here cannot be
-- referenced by DML in the same transaction.
ALTER TYPE "PackageCreditUsageStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
