-- Net amount paid for a package credit's sessions (integer halalas).
-- Nullable and additive: existing credits keep NULL and reports fall back to
-- allocating the purchase amount across the purchase's credits.
ALTER TABLE "PackageCredit" ADD COLUMN "netValue" DECIMAL(12,2);
