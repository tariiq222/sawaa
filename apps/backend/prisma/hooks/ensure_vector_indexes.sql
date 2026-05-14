-- Post-migration hook: re-create pgvector indexes that Prisma's diff engine
-- tries to drop because they use extended index types (ivfflat, hnsw) that
-- can't be expressed in schema.prisma.
--
-- Run automatically after every `prisma migrate dev` / `prisma migrate deploy`
-- via the `db:migrate` / `db:migrate:deploy` npm scripts.
--
-- Safe to run repeatedly (IF NOT EXISTS). Safe to run on fresh databases
-- (the target table is created by the AI BC migration, which runs first).

CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_cosine_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
