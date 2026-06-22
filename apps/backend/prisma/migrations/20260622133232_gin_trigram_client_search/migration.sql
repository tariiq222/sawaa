-- GIN trigram index for ILIKE / contains searches on Client names.
-- 
-- list-bookings and other handlers currently run `contains` with mode 'insensitive'
-- on firstName/lastName, which does a sequential scan on large tables. The
-- pg_trgm GIN index makes the same query an index scan.
--
-- The index is partial — only indexes active (non-deleted) clients, matching
-- the soft-delete filter used by the handlers.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "client_first_name_trgm_idx"
  ON "Client" USING GIN ("firstName" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "firstName" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "client_last_name_trgm_idx"
  ON "Client" USING GIN ("lastName" gin_trgm_ops)
  WHERE "deletedAt" IS NULL AND "lastName" IS NOT NULL;
