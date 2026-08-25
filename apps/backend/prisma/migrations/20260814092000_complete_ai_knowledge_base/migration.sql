ALTER TABLE "KnowledgeDocument"
  ADD COLUMN "content" TEXT,
  ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "lastIndexedAt" TIMESTAMP(3),
  ADD COLUMN "lastIndexErrorCode" TEXT,
  ADD COLUMN "contentHash" TEXT;

CREATE INDEX "KnowledgeDocument_isPublished_status_idx"
  ON "KnowledgeDocument"("isPublished", "status");
