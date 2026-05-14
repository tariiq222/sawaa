-- Employee: public directory fields
ALTER TABLE "Employee"
  ADD COLUMN "slug"           TEXT,
  ADD COLUMN "isPublic"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicBioAr"    TEXT,
  ADD COLUMN "publicBioEn"    TEXT,
  ADD COLUMN "publicImageUrl" TEXT;

CREATE UNIQUE INDEX "Employee_slug_key" ON "Employee"("slug");

-- ContactMessage
CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'REPLIED', 'ARCHIVED');

CREATE TABLE "ContactMessage" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "phone"      TEXT,
  "email"      TEXT,
  "subject"    TEXT,
  "body"       TEXT NOT NULL,
  "status"     "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt"     TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),

  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");
