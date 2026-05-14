-- Per-membership display profile: lets one user present different
-- name/title/avatar in each organization they belong to.
ALTER TABLE "Membership"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "jobTitle"    TEXT,
  ADD COLUMN "avatarUrl"   TEXT;

-- Sticky-organization fallback for login when user has multiple memberships.
-- Soft reference (no FK) — validated at login against active memberships.
ALTER TABLE "User"
  ADD COLUMN "lastActiveOrganizationId" TEXT;
