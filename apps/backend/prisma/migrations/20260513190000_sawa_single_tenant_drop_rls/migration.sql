-- Sawa Single-Tenant Migration
-- Drops RLS policies and tenant GUC functions that are no longer needed
-- in single-tenant mode (all rows share the default organization ID).

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'tenant_isolation_%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END $$;

-- Disable RLS on all tables that had tenant isolation policies.
-- We re-enable it only if there are remaining custom policies.
DO $$
DECLARE
  tbl record;
BEGIN
  FOR tbl IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = n.nspname
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND p.policyname IS NULL
  LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', tbl.table_name);
  END LOOP;
END $$;

-- Drop tenant GUC helper functions.
DROP FUNCTION IF EXISTS app_current_org_id();
DROP FUNCTION IF EXISTS app_rls_bypassed();
