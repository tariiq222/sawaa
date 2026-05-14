-- T-03: FeatureFlag schema changes — make organizationId nullable, add allowedPlans and limitKind

-- Step 1: Make organizationId nullable (was NOT NULL from SaaS-02g initial rollout)
ALTER TABLE "FeatureFlag" ALTER COLUMN "organizationId" DROP NOT NULL;

-- Step 2: Drop the old unique index (created as NOT NULL, not a constraint)
-- and recreate as a partial index WHERE organizationId IS NOT NULL.
-- This allows multiple rows to have (organizationId=NULL, key=NULL) without
-- violating the unique constraint, while still enforcing uniqueness per org.
DROP INDEX IF EXISTS "FeatureFlag_organizationId_key_key";
CREATE UNIQUE INDEX "FeatureFlag_organizationId_key_key"
  ON "FeatureFlag"("organizationId", "key")
  WHERE "organizationId" IS NOT NULL;

-- Step 3: Add allowedPlans as PostgreSQL text array (plan IDs allowed to use this flag)
ALTER TABLE "FeatureFlag" ADD COLUMN "allowedPlans" TEXT[] DEFAULT '{}';

-- Step 4: Add limitKind as optional string (e.g. "count", "percentage")
ALTER TABLE "FeatureFlag" ADD COLUMN "limitKind" TEXT;
