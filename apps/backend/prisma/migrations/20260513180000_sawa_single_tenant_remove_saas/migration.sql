-- Sawa Single-Tenant Migration
-- Removes SaaS-specific tables that are no longer needed in single-tenant mode.
-- All data scoped to the default organization remains in place.

-- Safety preflight: this migration is only valid after data has been collapsed
-- to the single default organization. Fail before any destructive DROP when a
-- live table still contains another organization id.
DO $$
DECLARE
  default_org constant text := '00000000-0000-0000-0000-000000000001';
  tbl text;
  offenders bigint;
BEGIN
  IF to_regclass('public."Organization"') IS NOT NULL THEN
    EXECUTE format('SELECT count(*) FROM %s WHERE id::text <> $1', 'public."Organization"')
      INTO offenders USING default_org;
    IF offenders > 0 THEN
      RAISE EXCEPTION
        'Unsafe single-tenant migration: Organization contains % non-default row(s). Expected only %.',
        offenders, default_org;
    END IF;
  END IF;

  FOR tbl IN
    SELECT format('%I.%I', table_schema, table_name)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'organizationId'
      AND table_name NOT IN (
        '_prisma_migrations',
        'DunningLog',
        'UsageRecord',
        'UsageCounter',
        'BillingCredit',
        'RefundUsageRevertLog',
        'OrganizationInvoiceCounter',
        'SubscriptionInvoice',
        'SavedCard',
        'Subscription',
        'Invitation',
        'Membership',
        'ImpersonationSession',
        'SuperAdminActionLog'
      )
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE "organizationId" IS NOT NULL AND "organizationId"::text <> $1', tbl)
      INTO offenders USING default_org;
    IF offenders > 0 THEN
      RAISE EXCEPTION
        'Unsafe single-tenant migration: %.organizationId contains % non-default row(s). Expected only %.',
        tbl, offenders, default_org;
    END IF;
  END LOOP;
END $$;

-- Drop FK constraints to tables being removed explicitly before dropping them.
-- This avoids blind DROP TABLE ... CASCADE while still allowing compatibility
-- columns such as organizationId to remain on tenant-scoped data tables.
DO $$
DECLARE
  constraint_row record;
  removed_tables constant text[] := ARRAY[
    'Organization',
    'Vertical',
    'VerticalTerminologyOverride',
    'VerticalSeedServiceCategory',
    'VerticalSeedDepartment',
    'Plan',
    'PlanVersion',
    'Subscription',
    'SavedCard',
    'SubscriptionInvoice',
    'OrganizationInvoiceCounter',
    'RefundUsageRevertLog',
    'BillingCredit',
    'UsageCounter',
    'UsageRecord',
    'DunningLog',
    'Membership',
    'Invitation',
    'SuperAdminActionLog',
    'ImpersonationSession'
  ];
BEGIN
  FOR constraint_row IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid IN (
        SELECT to_regclass(format('public.%I', table_name))
        FROM unnest(removed_tables) AS table_name
        WHERE to_regclass(format('public.%I', table_name)) IS NOT NULL
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', constraint_row.table_name, constraint_row.conname);
  END LOOP;
END $$;

-- Drop SaaS billing tables. The order follows known dependencies so CASCADE is
-- not required for normal schema objects.
DROP TABLE IF EXISTS "DunningLog";
DROP TABLE IF EXISTS "UsageRecord";
DROP TABLE IF EXISTS "UsageCounter";
DROP TABLE IF EXISTS "BillingCredit";
DROP TABLE IF EXISTS "RefundUsageRevertLog";
DROP TABLE IF EXISTS "OrganizationInvoiceCounter";
DROP TABLE IF EXISTS "SubscriptionInvoice";
DROP TABLE IF EXISTS "SavedCard";
DROP TABLE IF EXISTS "Subscription";
DROP TABLE IF EXISTS "PlanVersion";
DROP TABLE IF EXISTS "Plan";

-- Drop tenant management tables
DROP TABLE IF EXISTS "ImpersonationSession";
DROP TABLE IF EXISTS "SuperAdminActionLog";
DROP TABLE IF EXISTS "Invitation";
DROP TABLE IF EXISTS "Membership";

-- Drop vertical/seed tables
DROP TABLE IF EXISTS "VerticalTerminologyOverride";
DROP TABLE IF EXISTS "VerticalSeedServiceCategory";
DROP TABLE IF EXISTS "VerticalSeedDepartment";
DROP TABLE IF EXISTS "Vertical";

-- Drop Organization last (after all FKs referencing it are gone)
DROP TABLE IF EXISTS "Organization";

-- Note: organizationId columns on tenant-scoped tables are intentionally
-- preserved. In single-tenant mode they will all hold the same default
-- organization ID value.
