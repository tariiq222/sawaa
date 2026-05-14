-- P0 fix (2026-04-28): Membership.userId was a bare string with no FK constraint
-- to User.id, which prevented Prisma relation queries (e.g.
-- `prisma.user.findMany({ where: { memberships: { some: { organizationId } } } })`)
-- from working. Without this query path, ListUsersHandler could not filter users
-- by the current tenant via the join table, leaving the dashboard listing every
-- user across every organization. Add the FK so we can scope the listing.

-- Drop any orphan rows first (safe: orphans should not exist; defensive only).
DELETE FROM "Membership" WHERE "userId" NOT IN (SELECT "id" FROM "User");

ALTER TABLE "Membership"
  ADD CONSTRAINT "Membership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
