-- Tighten nullable OTP tables: tenant-scoped requests must not see global
-- NULL-organization OTP rows. System/pre-context flows still run with
-- app_current_org_id() IS NULL and keep access to those rows.

DROP POLICY IF EXISTS tenant_isolation_otp_code ON "OtpCode";
CREATE POLICY tenant_isolation_otp_code ON "OtpCode"
  USING      (app_current_org_id() IS NULL OR "organizationId"::uuid = app_current_org_id())
  WITH CHECK (app_current_org_id() IS NULL OR "organizationId"::uuid = app_current_org_id());

DROP POLICY IF EXISTS tenant_isolation_used_otp_session ON "UsedOtpSession";
CREATE POLICY tenant_isolation_used_otp_session ON "UsedOtpSession"
  USING      (app_current_org_id() IS NULL OR "organizationId"::uuid = app_current_org_id())
  WITH CHECK (app_current_org_id() IS NULL OR "organizationId"::uuid = app_current_org_id());
