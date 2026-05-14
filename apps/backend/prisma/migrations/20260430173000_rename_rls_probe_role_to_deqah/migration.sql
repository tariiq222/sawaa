-- Rename the SaaS-02h RLS probe role for the Deqah rebrand.
-- Existing migrations are immutable, so this forward migration preserves
-- the historical migration chain and moves the runtime role name.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'carekit_rls_probe')
     AND NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deqah_rls_probe') THEN
    ALTER ROLE carekit_rls_probe RENAME TO deqah_rls_probe;
  ELSIF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deqah_rls_probe') THEN
    CREATE ROLE deqah_rls_probe WITH LOGIN PASSWORD 'rls_probe_test_only_2026';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO deqah_rls_probe;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO deqah_rls_probe;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO deqah_rls_probe;
