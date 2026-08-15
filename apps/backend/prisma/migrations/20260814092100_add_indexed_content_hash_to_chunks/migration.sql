ALTER TABLE "DocumentChunk"
ADD COLUMN "indexedContentHash" TEXT;

CREATE INDEX "DocumentChunk_indexedContentHash_idx"
ON "DocumentChunk"("indexedContentHash");
