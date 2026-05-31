#!/bin/bash
# =============================================================================
# Init script: create the NOSUPERUSER application role for the Sawa backend.
# Runs once on a fresh PostgreSQL container startup (alphabetically, before any
# *.sql in this directory). Unlike a plain *.sql file, a *.sh script in
# /docker-entrypoint-initdb.d has access to the container environment, so we
# read the role name and password from the env vars wired by docker-compose
# (APP_DB_USER / APP_DB_PASSWORD) rather than from Postgres GUCs.
# =============================================================================
set -euo pipefail

APP_USER="${APP_DB_USER:-sawa_app}"
APP_PASS="${APP_DB_PASSWORD:-}"

if [ -z "${APP_PASS}" ]; then
  echo "ERROR: APP_DB_PASSWORD must be set" >&2
  exit 1
fi

# The official entrypoint exports POSTGRES_USER / POSTGRES_DB and provides a
# local socket connection for these init scripts. Pass the role name and
# password as psql variables so they are quoted safely server-side
# (quote_ident / quote_literal) instead of being interpolated into SQL text.
psql -v ON_ERROR_STOP=1 \
  --username "${POSTGRES_USER}" \
  --dbname "${POSTGRES_DB}" \
  -v app_user="${APP_USER}" \
  -v app_pass="${APP_PASS}" <<'EOSQL'
DO $$
DECLARE
  app_user TEXT := :'app_user';
  app_pass TEXT := :'app_pass';
BEGIN
  IF app_pass = '' THEN
    RAISE EXCEPTION 'APP_DB_PASSWORD must be set';
  END IF;

  -- Create role if it doesn't exist (idempotent)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_user) THEN
    EXECUTE format('CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION', app_user);
  END IF;

  -- Set / rotate password
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
EOSQL
