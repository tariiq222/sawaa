-- SaaS-02c: enable Row-Level Security on org-config + org-experience tables.
-- Uses the app_current_org_id() GUC helper defined in SaaS-01.
-- Policy semantics mirror SaaS-02a/02b:
--   * If GUC is unset (NULL), bypass filter — for background jobs and
--     migrations that legitimately need to touch every tenant.
--   * Otherwise, filter by organizationId = GUC.

ALTER TABLE "Branch"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceCategory"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Service"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceBookingConfig"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceDurationOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeServiceOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BusinessHour"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holiday"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrandingConfig"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeForm"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IntakeField"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rating"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationSettings"  ENABLE ROW LEVEL SECURITY;

-- FORCE applies policies even to the table owner.
ALTER TABLE "Branch"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "Department"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "ServiceCategory"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "Service"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "ServiceBookingConfig"  FORCE ROW LEVEL SECURITY;
ALTER TABLE "ServiceDurationOption" FORCE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeServiceOption" FORCE ROW LEVEL SECURITY;
ALTER TABLE "BusinessHour"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "Holiday"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "BrandingConfig"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "IntakeForm"            FORCE ROW LEVEL SECURITY;
ALTER TABLE "IntakeField"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "Rating"               FORCE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationSettings"  FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_branch
  ON "Branch"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_department
  ON "Department"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_service_category
  ON "ServiceCategory"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_service
  ON "Service"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_service_booking_config
  ON "ServiceBookingConfig"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_service_duration_option
  ON "ServiceDurationOption"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_employee_service_option
  ON "EmployeeServiceOption"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_business_hour
  ON "BusinessHour"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_holiday
  ON "Holiday"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_branding_config
  ON "BrandingConfig"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_intake_form
  ON "IntakeForm"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_intake_field
  ON "IntakeField"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_rating
  ON "Rating"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

CREATE POLICY tenant_isolation_organization_settings
  ON "OrganizationSettings"
  USING ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
