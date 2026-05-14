-- The Invitation table was modeled in schema (SaaS-06c) but never had its own
-- migration. Create it idempotently here, plus add the per-org display profile
-- fields (displayName, jobTitle) that get carried into the Membership on accept.

DO $$ BEGIN
  CREATE TYPE "InvitationStatus" AS ENUM ('PENDING','ACCEPTED','REVOKED','EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "Invitation" (
  "id"              TEXT             NOT NULL,
  "organizationId"  TEXT             NOT NULL,
  "email"           TEXT             NOT NULL,
  "role"            "MembershipRole" NOT NULL,
  "token"           TEXT             NOT NULL,
  "status"          "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt"       TIMESTAMP(3)     NOT NULL,
  "invitedByUserId" TEXT             NOT NULL,
  "acceptedAt"      TIMESTAMP(3),
  "revokedAt"       TIMESTAMP(3),
  "displayName"     TEXT,
  "jobTitle"        TEXT,
  "createdAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_organizationId_idx" ON "Invitation"("organizationId");
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");
CREATE INDEX IF NOT EXISTS "Invitation_email_organizationId_idx" ON "Invitation"("email","organizationId");
CREATE INDEX IF NOT EXISTS "Invitation_status_expiresAt_idx" ON "Invitation"("status","expiresAt");

DO $$ BEGIN
  ALTER TABLE "Invitation"
    ADD CONSTRAINT "Invitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- If the table already existed without the new fields, ALTER ADD them.
ALTER TABLE "Invitation"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "jobTitle"    TEXT;
