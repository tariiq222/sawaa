-- Sawa Single-Tenant Migration
-- Drops redundant organizationId columns from ProblemReport and Integration.
-- In single-tenant mode all rows share the same default org, making this column
-- unnecessary on singleton-per-org tables.

ALTER TABLE "ProblemReport" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "Integration" DROP COLUMN IF EXISTS "organizationId";

-- Drop the old composite unique index that included organizationId.
-- Prisma will recreate the new provider-only unique index on next migration.
DROP INDEX IF EXISTS "Integration_organizationId_provider_key";
