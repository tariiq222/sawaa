-- P0 fix (2026-04-28): six tables that the application registered as
-- tenant-scoped in `SCOPED_MODELS` but never had ROW LEVEL SECURITY enabled.
-- Without RLS, any code path that bypasses the Prisma tenant-scoping
-- extension (raw $queryRaw, direct connection, dump-and-load) returns
-- cross-tenant rows.
--
-- Tables covered:
--   * FcmToken            — push-notification tokens per client device
--   * Membership          — user↔org join (added FK in 20260428100000)
--   * OtpCode             — one-time codes for login/registration
--   * UsedOtpSession      — replay-protection tokens already consumed
--   * Subscription        — clinic SaaS subscription (one per org)
--   * UsageRecord         — billing usage counters per subscription
--
-- Pattern matches `20260425120000_saas_rls_hardening`: USING + WITH CHECK,
-- plus the super-admin bypass (`OR app_current_org_id() IS NULL`) used by
-- RlsHelper.runWithoutTenant inside system-context flows.

-- ── FcmToken (organizationId NOT NULL — comms/02f line) ─────────────────
ALTER TABLE "FcmToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FcmToken" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_fcm_token ON "FcmToken";
CREATE POLICY tenant_isolation_fcm_token ON "FcmToken"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ── Membership (organizationId NOT NULL) ────────────────────────────────
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_membership ON "Membership";
CREATE POLICY tenant_isolation_membership ON "Membership"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ── OtpCode (organizationId NULLABLE — pre-tenant flows like guest OTP) ─
-- NULL rows are global-scope (legitimate for guest-booking OTPs that arrive
-- before the tenant is resolved); the app must NEVER allow a tenant-scoped
-- caller to read or modify NULL-org rows that aren't theirs. We allow NULL
-- on the server-bypass path (app_current_org_id() IS NULL) to avoid breaking
-- pre-context flows but enforce equality otherwise.
ALTER TABLE "OtpCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OtpCode" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_otp_code ON "OtpCode";
CREATE POLICY tenant_isolation_otp_code ON "OtpCode"
  USING      (
    app_current_org_id() IS NULL
    OR "organizationId" IS NULL
    OR "organizationId"::uuid = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL
    OR "organizationId" IS NULL
    OR "organizationId"::uuid = app_current_org_id()
  );

-- ── UsedOtpSession (organizationId NULLABLE) ────────────────────────────
ALTER TABLE "UsedOtpSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsedOtpSession" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_used_otp_session ON "UsedOtpSession";
CREATE POLICY tenant_isolation_used_otp_session ON "UsedOtpSession"
  USING      (
    app_current_org_id() IS NULL
    OR "organizationId" IS NULL
    OR "organizationId"::uuid = app_current_org_id()
  )
  WITH CHECK (
    app_current_org_id() IS NULL
    OR "organizationId" IS NULL
    OR "organizationId"::uuid = app_current_org_id()
  );

-- ── Subscription (organizationId NOT NULL — one per org) ────────────────
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_subscription ON "Subscription";
CREATE POLICY tenant_isolation_subscription ON "Subscription"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);

-- ── UsageRecord (organizationId NOT NULL) ───────────────────────────────
ALTER TABLE "UsageRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageRecord" FORCE  ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_usage_record ON "UsageRecord";
CREATE POLICY tenant_isolation_usage_record ON "UsageRecord"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
