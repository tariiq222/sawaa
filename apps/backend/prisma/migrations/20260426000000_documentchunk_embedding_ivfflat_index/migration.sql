-- IVFFlat index on DocumentChunk.embedding for pgvector cosine similarity
-- Replaces sequential scan in semantic-search.handler.ts ($queryRaw with `<=>`).
-- Lists=100 is the standard recommendation for ~10k–1M rows; we can tune later.
-- IVFFlat requires populated vectors before indexing — safe here since the column
-- is nullable and the table is small in early stages; PG will skip nulls.
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_ivfflat_idx"
  ON "DocumentChunk"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);
