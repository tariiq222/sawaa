-- Create the pgvector ANN index for semantic search.
--
-- Why this lives in a real migration (not a side hook):
--   The previous `prisma/hooks/ensure_vector_indexes.sql` hook was only invoked
--   by the `prisma:migrate*` npm scripts. The production Dockerfile CMD runs
--   `prisma migrate deploy` directly (without the npm wrapper), so the hook never
--   ran in production and `DocumentChunk.embedding` fell back to a sequential
--   scan on every semantic search. Encoding the index as a migration guarantees
--   `prisma migrate deploy` creates it.
--
-- Index type (ivfflat / vector_cosine_ops) cannot be expressed in schema.prisma,
-- so Prisma's diff engine ignores it. This raw SQL migration is additive and
-- idempotent (IF NOT EXISTS), safe to apply on databases where the hook already
-- created the index.
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_cosine_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
