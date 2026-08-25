ALTER TABLE "KnowledgeDocument"
ADD COLUMN "indexingLeaseOwner" TEXT,
ADD COLUMN "indexingLeaseExpiresAt" TIMESTAMP(3);

CREATE INDEX "KnowledgeDocument_indexingLeaseExpiresAt_idx"
ON "KnowledgeDocument"("indexingLeaseExpiresAt");
