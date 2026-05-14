-- SaaS-02a: add nullable organizationId to identity models + FK + indexes.
-- Nullable during backfill phase; NOT NULL applied in saas02a_identity_not_null.

-- ─────────────────────────────────────────────────────────────────────────────
-- RefreshToken
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "RefreshToken" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "RefreshToken_organizationId_idx" ON "RefreshToken"("organizationId");

ALTER TABLE "RefreshToken"
  ADD CONSTRAINT "RefreshToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- CustomRole
--   Drop global name unique → replace with composite (organizationId, name).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "CustomRole" DROP CONSTRAINT IF EXISTS "CustomRole_name_key";
DROP INDEX IF EXISTS "CustomRole_name_key";

ALTER TABLE "CustomRole" ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "CustomRole_organizationId_name_key"
  ON "CustomRole"("organizationId", "name");

CREATE INDEX "CustomRole_organizationId_idx" ON "CustomRole"("organizationId");

ALTER TABLE "CustomRole"
  ADD CONSTRAINT "CustomRole_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Permission (denormalized organizationId to match parent CustomRole)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Permission" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "Permission_organizationId_idx" ON "Permission"("organizationId");

ALTER TABLE "Permission"
  ADD CONSTRAINT "Permission_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
