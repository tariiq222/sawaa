-- Migration: add_subscription_scheduled_change_blocked
-- Phase 2 / Bug B8: Track when a scheduled plan change has been blocked at
-- swap-time because tenant usage now exceeds the target plan's limits.
-- Populated by the ProcessScheduledPlanChangesCron, surfaced to super-admin.

ALTER TABLE "Subscription"
    ADD COLUMN "scheduledChangeBlockedReason" TEXT;
