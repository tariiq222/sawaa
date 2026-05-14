-- AlterTable: add onboardingCompletedAt to Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);
