-- Add PENDING to the PackagePurchaseStatus enum.
--
-- PENDING marks a self-purchase (website/mobile, session-packages Phase 4) whose
-- Moyasar payment has not yet completed. A PENDING PackagePurchase carries NO
-- PackageCredit buckets and is excluded from every consumption path
-- (BookFromCredit / GetMatchingCredits gate strictly on ACTIVE), so its credit can
-- never be booked before the online payment lands. On a successful Moyasar webhook
-- the activation consumer flips PENDING -> ACTIVE and issues the credit buckets;
-- a failed/abandoned payment leaves the purchase PENDING with no credits.
--
-- Additive enum value — safe and non-destructive. Postgres requires ALTER TYPE
-- ADD VALUE to run outside a transaction block; Prisma runs each migration
-- statement-by-statement so this is fine on its own.

ALTER TYPE "PackagePurchaseStatus" ADD VALUE IF NOT EXISTS 'PENDING';
