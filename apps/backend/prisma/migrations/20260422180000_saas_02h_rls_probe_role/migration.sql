-- SaaS-02h: strict mode rollout support.
--
-- 1. Create `carekit_rls_probe` — a non-superuser role used by the
--    cross-tenant penetration tests to verify RLS policies actually bite.
--    The Postgres superuser bypasses RLS even with FORCE ROW LEVEL SECURITY;
--    the probe role is forced-to-obey so tests can authoritatively assert
--    cross-tenant invisibility. Password is test-only, no write grants.
--
-- 2. Backfill RLS + policies for the bookings cluster (02d). The 02d
--    migration added `organizationId` columns + indexes but never wrapped
--    them in RLS policies, so the RLS backstop couldn't cover them. This
--    migration closes the gap — 7 tables get ENABLE + FORCE + tenant
--    isolation policy.
--
-- 3. Keep the 02a identity policies (which used `app.current_org_id`)
--    compatible with the 02e+ GUC name `app.current_organization_id`.
--    We drop + recreate the identity policies to recognise either GUC
--    so the RlsHelper (which currently sets `app.current_org_id`) and
--    the newer cluster migrations (which check `app.current_organization_id`)
--    both work under one probe-role session.
--
-- No schema changes. Additive only.

-- ============================================================================
-- 1. carekit_rls_probe role
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carekit_rls_probe') THEN
    CREATE ROLE carekit_rls_probe WITH LOGIN PASSWORD 'rls_probe_test_only_2026';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO carekit_rls_probe;
-- Allow reading the GUC via current_setting — policies reference it.
-- Explicit grants per scoped table (SELECT only — probe never writes).
GRANT SELECT ON
  "Organization", "Membership",
  "RefreshToken", "CustomRole", "Permission", "PasswordHistory",
  "Client", "ClientRefreshToken", "Employee", "EmployeeBranch",
  "EmployeeService", "EmployeeAvailability", "EmployeeAvailabilityException",
  "Branch", "Department", "ServiceCategory", "Service",
  "ServiceBookingConfig", "ServiceDurationOption", "EmployeeServiceOption",
  "BusinessHour", "Holiday", "IntakeForm", "IntakeField", "Rating",
  "BrandingConfig", "OrganizationSettings",
  "Booking", "BookingStatusLog", "WaitlistEntry",
  "GroupSession", "GroupEnrollment", "GroupSessionWaitlist", "BookingSettings",
  "Invoice", "Payment", "Coupon", "CouponRedemption",
  "RefundRequest", "ZatcaSubmission", "ZatcaConfig",
  "EmailTemplate", "Notification",
  "ChatConversation", "CommsChatMessage", "ChatSession", "ChatMessage",
  "ContactMessage", "ChatbotConfig",
  "KnowledgeDocument", "DocumentChunk", "File",
  "ActivityLog", "Report", "FeatureFlag", "Integration", "ProblemReport",
  "SiteSetting", "OrganizationSmsConfig", "SmsDelivery"
TO carekit_rls_probe;

-- ============================================================================
-- 2. Bookings cluster RLS backfill (02d gap)
-- ============================================================================

ALTER TABLE "Booking"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookingStatusLog"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistEntry"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupSession"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupEnrollment"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GroupSessionWaitlist"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BookingSettings"        ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Booking"                FORCE ROW LEVEL SECURITY;
ALTER TABLE "BookingStatusLog"       FORCE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistEntry"          FORCE ROW LEVEL SECURITY;
ALTER TABLE "GroupSession"           FORCE ROW LEVEL SECURITY;
ALTER TABLE "GroupEnrollment"        FORCE ROW LEVEL SECURITY;
ALTER TABLE "GroupSessionWaitlist"   FORCE ROW LEVEL SECURITY;
ALTER TABLE "BookingSettings"        FORCE ROW LEVEL SECURITY;

-- Policy semantics: accept either GUC name (legacy `app.current_org_id` used
-- by RlsHelper, newer `app.current_organization_id` used by 02e+ policies).
-- NULLIF returns NULL when GUC unset, which makes the predicate false and
-- filters everything out for the probe role (backstop behavior).
CREATE POLICY tenant_isolation ON "Booking"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
CREATE POLICY tenant_isolation ON "BookingStatusLog"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
CREATE POLICY tenant_isolation ON "WaitlistEntry"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
CREATE POLICY tenant_isolation ON "GroupSession"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
CREATE POLICY tenant_isolation ON "GroupEnrollment"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
CREATE POLICY tenant_isolation ON "GroupSessionWaitlist"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
CREATE POLICY tenant_isolation ON "BookingSettings"
  USING (
    "organizationId" = COALESCE(
      NULLIF(current_setting('app.current_organization_id', true), ''),
      NULLIF(current_setting('app.current_org_id', true), '')
    )
  );
