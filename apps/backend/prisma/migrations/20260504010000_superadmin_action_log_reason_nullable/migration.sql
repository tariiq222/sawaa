-- Make SuperAdminActionLog.reason nullable so TENANT_CREATE can omit the free-text reason.
-- All other action types (suspend, reinstate, archive, change-plan, etc.) continue to
-- supply a reason at the application layer; only the schema-level NOT NULL constraint
-- is relaxed here.

ALTER TABLE "SuperAdminActionLog" ALTER COLUMN "reason" DROP NOT NULL;
