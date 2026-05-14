-- SaaS-01: RLS scaffolding.
-- We register a session-scoped custom parameter (`app.current_org_id`) that
-- the application will set via `SET LOCAL app.current_org_id = '...'` per
-- transaction once Plan 02 activates enforcement.
--
-- No policies are applied to real tables here — Plan 02 enables them as each
-- cluster gains its `organization_id` column. This migration is a placeholder
-- so the GUC exists on every environment from day one.

DO $$
BEGIN
  -- Ensure gen_random_uuid() is available (used by backfill migrations).
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  -- Custom parameter: empty default. Set per-transaction by the app.
  -- Prefixed parameters are the supported way to define app-level GUCs in
  -- PostgreSQL (core parameters reject unknown names).
  PERFORM set_config('app.current_org_id', '', false);
END $$;

-- Helper function: returns the current tenant id or NULL if unset.
-- Plan 02 policies reference this to decide row visibility.
CREATE OR REPLACE FUNCTION app_current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid;
$$;

COMMENT ON FUNCTION app_current_org_id() IS
  'Reads app.current_org_id GUC set by TenantRlsInterceptor. Returns NULL when unset (used by Plan 02 policies as a bypass for system jobs).';
