-- SaaS-02a: enable Row-Level Security on identity tables.
-- Uses the app_current_org_id() GUC helper defined in SaaS-01.
-- Policy semantics:
--   * If GUC is unset (NULL), bypass filter — for background jobs and
--     migrations that legitimately need to touch every tenant. App code
--     must always set GUC inside transactions once Plan 02h flips
--     TENANT_ENFORCEMENT=strict.
--   * Otherwise, filter by organizationId = GUC.

ALTER TABLE "RefreshToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Permission"   ENABLE ROW LEVEL SECURITY;

-- FORCE applies policies even to the table owner. In prod the app connects
-- as a non-owner role so this is belt-and-suspenders; in dev/test the app
-- role often IS the owner, so FORCE is required for policies to bite.
ALTER TABLE "RefreshToken" FORCE ROW LEVEL SECURITY;
ALTER TABLE "CustomRole"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "Permission"   FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_refresh_token ON "RefreshToken"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_custom_role ON "CustomRole"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_permission ON "Permission"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
