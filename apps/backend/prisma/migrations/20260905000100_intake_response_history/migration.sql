-- Expand only: preserve existing response rows, including unresolved duplicates.
-- A separate, reviewed rollout introduces the current-response unique index.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE "IntakeResponse"
ADD COLUMN "supersededAt" TIMESTAMP(3),
ADD COLUMN "supersededById" TEXT;

-- No live-row foreign keys: authorized deletion must retain these snapshots.
CREATE TABLE "IntakeResponseRevision" (
    "id" TEXT NOT NULL,
    "sourceResponseId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "clientId" TEXT,
    "answers" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL,
    CONSTRAINT "IntakeResponseRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntakeResponseRevision_sourceResponseId_capturedAt_idx"
ON "IntakeResponseRevision"("sourceResponseId", "capturedAt");

CREATE INDEX "IntakeResponseRevision_bookingId_formId_idx"
ON "IntakeResponseRevision"("bookingId", "formId");

RESET lock_timeout;
RESET statement_timeout;
