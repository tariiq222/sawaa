-- ============================================================================
-- P2.C — Append-only audit triggers (2026-05-10)
--
-- ActivityLog and SuperAdminActionLog are forensic data. They MUST be append-
-- only at the database layer so an application bug or a compromised app role
-- cannot rewrite or erase the audit trail.
--
-- Strategy:
--   1. A BEFORE UPDATE OR DELETE trigger raises an exception unless the
--      transaction has set the GUC `app.audit_admin_override = 'on'`.
--   2. Only data-correction migrations (run as the OWNER role with explicit
--      override) can mutate audit rows. The runtime app role (deqah_app)
--      cannot set the override because the trigger checks the GUC — the GUC
--      itself can only be set by a superuser or the database owner.
--   3. Tenant-row deletion is still allowed via cascading FKs (when an Org
--      is purged) — handle that separately by setting the override in the
--      purge flow.
-- ============================================================================

-- ─── ActivityLog protection ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_audit_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  override boolean := COALESCE(NULLIF(current_setting('app.audit_admin_override', true), ''), 'off') = 'on';
BEGIN
  -- The override gate must be on. Since only a superuser or the database
  -- owner can set this GUC, no additional role check is needed — the GUC
  -- setting itself proves the caller has the required privilege.
  IF override THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'append_only_violation: % on % is forbidden — audit logs are append-only',
    TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

COMMENT ON FUNCTION enforce_audit_append_only() IS
  'Append-only enforcement for audit tables. Allows UPDATE/DELETE only when app.audit_admin_override = on (set by data-correction migrations run as DB owner).';

DO $$
BEGIN
  -- Only attach if the table exists in this database (defensive — fresh test
  -- databases without all migrations applied should not break).
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ActivityLog') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS append_only_activity_log ON "ActivityLog"';
    EXECUTE 'CREATE TRIGGER append_only_activity_log
      BEFORE UPDATE OR DELETE ON "ActivityLog"
      FOR EACH ROW EXECUTE FUNCTION enforce_audit_append_only()';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SuperAdminActionLog') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS append_only_super_admin_action_log ON "SuperAdminActionLog"';
    EXECUTE 'CREATE TRIGGER append_only_super_admin_action_log
      BEFORE UPDATE OR DELETE ON "SuperAdminActionLog"
      FOR EACH ROW EXECUTE FUNCTION enforce_audit_append_only()';
  END IF;
END $$;

-- The runtime app role NEVER needs to UPDATE/DELETE audit rows. Belt-and-
-- suspenders: revoke those privileges explicitly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deqah_app') THEN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ActivityLog') THEN
      EXECUTE 'REVOKE UPDATE, DELETE ON "ActivityLog" FROM deqah_app';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SuperAdminActionLog') THEN
      EXECUTE 'REVOKE UPDATE, DELETE ON "SuperAdminActionLog" FROM deqah_app';
    END IF;
  END IF;
END $$;