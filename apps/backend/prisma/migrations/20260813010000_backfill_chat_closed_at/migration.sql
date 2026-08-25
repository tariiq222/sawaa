UPDATE "ChatConversation"
SET "closedAt" = "updatedAt"
WHERE "status" = 'CLOSED' AND "closedAt" IS NULL;
