-- Add sequential readable reference number to GroupSession.
-- Postgres SERIAL (via autoincrement) will backfill existing rows with sequential values automatically.
CREATE SEQUENCE IF NOT EXISTS "GroupSession_ref_seq";
ALTER TABLE "GroupSession" ADD COLUMN "ref" INTEGER NOT NULL DEFAULT nextval('"GroupSession_ref_seq"');
ALTER SEQUENCE "GroupSession_ref_seq" OWNED BY "GroupSession"."ref";
CREATE UNIQUE INDEX "GroupSession_ref_key" ON "GroupSession"("ref");
