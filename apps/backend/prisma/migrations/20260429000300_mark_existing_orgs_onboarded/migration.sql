-- Existing tenants predate the onboarding wizard. Treat them as already
-- onboarded so the dashboard redirect only applies to newly self-registered
-- tenants.
UPDATE "Organization"
SET "onboardingCompletedAt" = NOW()
WHERE "onboardingCompletedAt" IS NULL;
