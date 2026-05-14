-- ============================================================================
-- RLS HARDENING — convert RLS from decorative to load-bearing.
-- Issued: 2026-05-09. Owner-only review tier (CLAUDE.md security tier).
--
-- Three changes:
--
-- 1. Introduce a non-owner runtime role `deqah_app` with NOBYPASSRLS so the
--    app process can no longer bypass policies via OWNER privilege.
--    Migrations continue to run as the existing OWNER (`deqah`).
--
-- 2. Introduce a deliberate bypass GUC `app.bypass_rls` (default 'off') for
--    super-admin / cron / webhook flows that legitimately need cross-tenant
--    reach. The bypass is also wired into a new helper `app_rls_bypassed()`.
--
-- 3. Replace every `tenant_isolation_<table>` policy so its predicate is:
--      "organizationId" = app_current_org_id() OR app_rls_bypassed()
--    The previous "OR app_current_org_id() IS NULL" arm is dropped — under
--    NOBYPASSRLS this had been a fail-OPEN default. Now: missing GUC + no
--    bypass = 0 rows (fail-closed).
--
-- Operational note: the new role is granted SELECT/INSERT/UPDATE/DELETE on
-- every existing table at migration time and via DEFAULT PRIVILEGES going
-- forward. The DATABASE_URL used by the backend service must be switched to
-- this role (see docker/docker-compose.prod.yml change in the same PR).
-- ============================================================================

-- ─── Create non-owner runtime role (idempotent) ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deqah_app') THEN
    -- Password is set via psql out-of-band before the app boots; the
    -- migration must not embed credentials. Caller sets it with:
    --   ALTER ROLE deqah_app WITH PASSWORD '...';
    EXECUTE 'CREATE ROLE deqah_app LOGIN NOBYPASSRLS PASSWORD ' ||
            quote_literal('CHANGE_ME_AT_DEPLOY');
  ELSE
    -- Ensure NOBYPASSRLS is enforced even if the role pre-existed.
    EXECUTE 'ALTER ROLE deqah_app NOBYPASSRLS';
  END IF;
END $$;

-- Grants: app role can do CRUD on every existing table + sequence, no DDL.
-- GRANT CONNECT requires a literal database identifier; current_database() is
-- a function call and not accepted in DDL identifier position. Resolve at
-- runtime via DO/EXECUTE so the migration works on any DB name.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO deqah_app', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO deqah_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO deqah_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO deqah_app;

-- Default privileges for FUTURE tables/sequences (created by future migrations).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO deqah_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO deqah_app;

-- ─── Bypass GUC + helper ────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM set_config('app.bypass_rls', 'off', false);
END $$;

CREATE OR REPLACE FUNCTION app_rls_bypassed()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.bypass_rls', true), ''), 'off') = 'on';
$$;

COMMENT ON FUNCTION app_rls_bypassed() IS
  'Returns true when app.bypass_rls = ''on''. Set via SET LOCAL by RlsHelper.runWithoutTenant for super-admin / cron / webhook flows that legitimately need cross-tenant reach.';

-- ─── Replace every tenant_isolation policy with strict variant ──────────────
-- Pattern: "organizationId" = app_current_org_id() OR app_rls_bypassed()
--
-- We enumerate every (table, policy_name) pair currently defined.  Because
-- pg_policies introspection is awkward in a static SQL file, we instead
-- DROP-AND-CREATE explicitly for every known table.  This list MUST cover
-- every table that has ENABLE ROW LEVEL SECURITY today; the source of truth
-- is `SCOPED_MODELS` in apps/backend/src/infrastructure/database/prisma.service.ts.
--
-- For each table the pattern is identical, so we use a DO block + dynamic SQL.

DO $$
DECLARE
  t text;
  policy_name text;
  scoped_tables text[] := ARRAY[
    -- identity
    'RefreshToken', 'CustomRole', 'Permission', 'PasswordHistory',
    -- people
    'Client', 'ClientRefreshToken', 'Employee', 'EmployeeBranch', 'EmployeeService',
    'EmployeeAvailability', 'EmployeeAvailabilityException', 'EmployeeBreak',
    -- org-config + org-experience
    'Branch', 'Department', 'ServiceCategory', 'Service',
    'ServiceBookingConfig', 'ServiceDurationOption', 'EmployeeServiceOption',
    'BusinessHour', 'Holiday', 'BrandingConfig', 'IntakeForm', 'IntakeField',
    'Rating', 'OrganizationSettings',
    -- bookings
    'Booking', 'BookingStatusLog', 'WaitlistEntry',
    'GroupSession', 'GroupEnrollment', 'GroupSessionWaitlist', 'BookingSettings',
    -- finance
    'Invoice', 'Payment', 'Coupon', 'CouponRedemption', 'RefundRequest',
    'OrganizationPaymentConfig',
    -- comms + ai
    'EmailTemplate', 'Notification', 'ChatConversation', 'CommsChatMessage',
    'ChatSession', 'ChatMessage', 'ContactMessage', 'ChatbotConfig', 'FcmToken',
    'OrganizationEmailConfig', 'NotificationDeliveryLog',
    'OrganizationSmsConfig', 'SmsDelivery',
    -- ai
    'KnowledgeDocument', 'DocumentChunk',
    -- media
    'File',
    -- ops
    'ActivityLog', 'Report', 'ProblemReport', 'Integration', 'SiteSetting',
    -- identity (otp + reset + invitation + membership)
    'OtpCode', 'UsedOtpSession', 'EmailVerificationToken', 'Membership',
    -- billing
    'Subscription', 'UsageRecord', 'SavedCard', 'DunningLog', 'BillingCredit',
    'Invitation', 'UsageCounter', 'OrganizationInvoiceCounter',
    'RefundUsageRevertLog',
    -- integrations (zoho)
    'ZohoContactLink', 'ZohoInvoiceLink', 'ZohoCreditNoteLink',
    'ZohoWebhookEvent', 'IntegrationAuditLog'
  ];
BEGIN
  FOREACH t IN ARRAY scoped_tables LOOP
    -- Only act if the table actually exists (defensive — some envs may not
    -- have all tables yet, e.g. fresh test DB without all migrations).
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- Force RLS so OWNER (deqah) is also subject to policies. Without this,
      -- migrations applied as OWNER would still bypass during runtime if
      -- the runtime role were ever swapped back.
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',  t);

      -- Derive snake_case policy name: lowercase, prefix tenant_isolation_.
      policy_name := 'tenant_isolation_' || lower(regexp_replace(t, '([a-z0-9])([A-Z])', '\1_\2', 'g'));

      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, t);

      -- Strict policy: the previous "OR app_current_org_id() IS NULL" arm
      -- (fail-OPEN on missing GUC) is replaced with "OR app_rls_bypassed()"
      -- (fail-CLOSED unless an explicit bypass GUC is set by RlsHelper).
      --
      -- We cast both sides to text for tables whose organizationId column is
      -- text rather than uuid (legacy from the SaaS-02 migrations).
      EXECUTE format(
        'CREATE POLICY %I ON %I '
        'USING ("organizationId"::text = app_current_org_id()::text OR app_rls_bypassed()) '
        'WITH CHECK ("organizationId"::text = app_current_org_id()::text OR app_rls_bypassed())',
        policy_name, t
      );
    END IF;
  END LOOP;
END $$;
