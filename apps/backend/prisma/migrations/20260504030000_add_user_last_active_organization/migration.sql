-- AlterTable
-- NOTE: The column was also added by 20260502120000_add_membership_display_profile.
-- IF NOT EXISTS makes this migration idempotent and safe to re-apply on a fresh DB.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveOrganizationId" TEXT;
