-- Drop subscription tables introduced in migration
-- `20260419000000_phase4_subscriptions_groups_refunds`.
--
-- CareKit is a booking platform; subscription plans / client subscriptions
-- were added in Phase 4 as a speculation that turned out to be out of scope
-- (see docs on product direction). This migration removes the tables and
-- enums so the schema matches the rest of the codebase after Phase 4 Track A
-- has been deleted.

DROP TABLE IF EXISTS "ClientSubscription" CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlan" CASCADE;
DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "SubscriptionBenefitType";
