-- =============================================================================
-- Init script: create the NOBYPASSRLS application role for Sawa backend
-- This script runs once on a fresh PostgreSQL container startup.
-- =============================================================================

DO $$
DECLARE
  app_user TEXT := COALESCE(current_setting('APP_DB_USER', true), 'deqah_app');
  app_pass TEXT := COALESCE(current_setting('APP_DB_PASSWORD', true), '');
BEGIN
  IF app_pass = '' THEN
    RAISE EXCEPTION 'APP_DB_PASSWORD must be set';
  END IF;

  -- Create role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', app_user);
  END IF;

  -- Set password
  EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', app_user, app_pass);

  -- Grant schema usage and table privileges on the current database
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), app_user);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_user);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_user);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', app_user);

  RAISE NOTICE 'Application user % created/updated successfully', app_user;
END $$;
