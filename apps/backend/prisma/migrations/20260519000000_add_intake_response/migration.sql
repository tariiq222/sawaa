-- ============================================================
-- Migration: add_intake_response
-- Created:   2026-05-19
--
-- PURPOSE:
--   Add IntakeResponse model to store client answers to
--   intake forms (pre-session, pre-booking, etc.).
--   Answers stored as JSON keyed by fieldId.
--   No FK to Booking (cross-BC reference — plain string).
-- ============================================================

CREATE TABLE "IntakeResponse" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "clientId" TEXT,
    "answers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IntakeResponse_bookingId_idx" ON "IntakeResponse"("bookingId");
CREATE INDEX "IntakeResponse_formId_idx" ON "IntakeResponse"("formId");

ALTER TABLE "IntakeResponse" ADD CONSTRAINT "IntakeResponse_formId_fkey" FOREIGN KEY ("formId") REFERENCES "IntakeForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
