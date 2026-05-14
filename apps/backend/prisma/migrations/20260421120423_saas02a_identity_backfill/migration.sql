-- SaaS-02a: backfill organizationId on identity models.
-- Assigns every pre-existing row to the default organization seeded in SaaS-01.
-- Idempotent: WHERE organizationId IS NULL filters out already-migrated rows.

UPDATE "RefreshToken"
SET "organizationId" = '00000000-0000-0000-0000-000000000001'
WHERE "organizationId" IS NULL;

UPDATE "CustomRole"
SET "organizationId" = '00000000-0000-0000-0000-000000000001'
WHERE "organizationId" IS NULL;

UPDATE "Permission"
SET "organizationId" = '00000000-0000-0000-0000-000000000001'
WHERE "organizationId" IS NULL;
