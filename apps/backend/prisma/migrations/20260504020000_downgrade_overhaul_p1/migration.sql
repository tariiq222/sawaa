-- Phase 1 Downgrade Overhaul: Grace columns + ZATCA always-on + storage counter cleanup

-- Add grace period columns to Subscription (for API_ACCESS and WEBHOOKS feature revocation)
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "apiAccessGraceUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "webhooksGraceUntil" TIMESTAMP(3);

-- Add grace period column to OrganizationSettings (for CUSTOM_DOMAIN feature revocation)
ALTER TABLE "OrganizationSettings"
  ADD COLUMN IF NOT EXISTS "customDomainGraceUntil" TIMESTAMP(3);

-- Seed zatca = true on all existing plan limits (idempotent — ZATCA is now always-on)
UPDATE "Plan" SET limits = jsonb_set(limits, '{zatca}', 'true', true);

-- Remove obsolete storage usage counters
DELETE FROM "UsageCounter" WHERE "featureKey" = 'storage';
