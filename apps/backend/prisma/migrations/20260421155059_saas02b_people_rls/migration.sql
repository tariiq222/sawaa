-- SaaS-02b: enable Row-Level Security on people-cluster tables.
-- Uses the app_current_org_id() GUC helper defined in SaaS-01.
-- Policy semantics mirror SaaS-02a:
--   * If GUC is unset (NULL), bypass filter — for background jobs and
--     migrations that legitimately need to touch every tenant.
--   * Otherwise, filter by organizationId = GUC.

ALTER TABLE "Client"                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee"                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeBranch"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeService"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeAvailability"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeAvailabilityException" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientRefreshToken"            ENABLE ROW LEVEL SECURITY;

-- FORCE applies policies even to the table owner (see SaaS-02a comment).
ALTER TABLE "Client"                        FORCE ROW LEVEL SECURITY;
ALTER TABLE "Employee"                      FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeBranch"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeService"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeAvailability"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeAvailabilityException" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ClientRefreshToken"            FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_client
  ON "Client"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_employee
  ON "Employee"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_employee_branch
  ON "EmployeeBranch"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_employee_service
  ON "EmployeeService"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_employee_availability
  ON "EmployeeAvailability"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_employee_availability_exception
  ON "EmployeeAvailabilityException"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_client_refresh_token
  ON "ClientRefreshToken"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
