-- Durable message ordering and a cross-process assistant lease.
-- Existing messages receive a deterministic global sequence by their former
-- chronological key; new messages consume the PostgreSQL sequence atomically.

CREATE SEQUENCE "CommsChatMessage_sequence_seq";

ALTER TABLE "CommsChatMessage"
  ADD COLUMN "sequence" BIGINT NOT NULL
    DEFAULT nextval('"CommsChatMessage_sequence_seq"');

WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS seq
  FROM "CommsChatMessage"
)
UPDATE "CommsChatMessage" AS message
SET "sequence" = ordered.seq
FROM ordered
WHERE message."id" = ordered."id";

SELECT setval(
  '"CommsChatMessage_sequence_seq"',
  GREATEST(COALESCE((SELECT MAX("sequence") FROM "CommsChatMessage"), 0) + 1, 1),
  false
);

ALTER SEQUENCE "CommsChatMessage_sequence_seq"
  OWNED BY "CommsChatMessage"."sequence";

ALTER TABLE "ChatConversation"
  ADD COLUMN "assistantLeaseOwner" TEXT,
  ADD COLUMN "assistantLeaseExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CommsChatMessage_sequence_key"
  ON "CommsChatMessage"("sequence");
CREATE INDEX "CommsChatMessage_conversationId_sequence_idx"
  ON "CommsChatMessage"("conversationId", "sequence");
CREATE INDEX "ChatConversation_assistantLeaseExpiresAt_idx"
  ON "ChatConversation"("assistantLeaseExpiresAt");
