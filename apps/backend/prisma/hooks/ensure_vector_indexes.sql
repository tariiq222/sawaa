-- Post-migration hook: re-create pgvector indexes that Prisma's diff engine
-- tries to drop because they use extended index types (ivfflat, hnsw) that
-- can't be expressed in schema.prisma.
--
-- SOURCE OF TRUTH is now the migration
-- `20260629000000_add_document_chunk_vector_index`, which `prisma migrate deploy`
-- always applies (including in the production Dockerfile CMD). This hook is kept
-- only as a redundant safety net for the local `prisma:migrate*` npm scripts and
-- for older databases; it must stay byte-for-byte identical to that migration's
-- index definition.
--
-- Run automatically after every `prisma migrate dev` / `prisma migrate deploy`
-- via the `prisma:migrate` / `prisma:migrate:deploy` npm scripts.
--
-- Safe to run repeatedly (IF NOT EXISTS). Safe to run on fresh databases
-- (the target table is created by the AI BC migration, which runs first).

CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_cosine_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
