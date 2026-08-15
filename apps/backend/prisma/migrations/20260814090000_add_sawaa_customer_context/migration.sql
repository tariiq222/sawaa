ALTER TABLE "ChatConversation"
  ADD COLUMN "customerContext" JSONB,
  ADD COLUMN "customerContextVersion" INTEGER NOT NULL DEFAULT 0;
