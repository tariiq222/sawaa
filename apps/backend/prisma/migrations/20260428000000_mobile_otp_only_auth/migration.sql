-- Mobile OTP-only auth foundation:
--   * Extend OtpPurpose enum with MOBILE_REGISTER + MOBILE_LOGIN
--   * User: nullable passwordHash, new firstName/lastName/phoneVerifiedAt/emailVerifiedAt
--   * User.phone is now globally unique (still nullable)
--   * New EmailVerificationToken table (org-scoped, mirrors PasswordResetToken token-selector pattern)
-- Owner-only review tier (identity / auth — see CLAUDE.md security tier).

-- AlterEnum: add new OtpPurpose values
ALTER TYPE "OtpPurpose" ADD VALUE 'MOBILE_REGISTER';
ALTER TYPE "OtpPurpose" ADD VALUE 'MOBILE_LOGIN';

-- AlterTable: User — relax passwordHash, add nullable name parts + verification timestamps
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "phoneVerifiedAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateTable: EmailVerificationToken
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenSelector" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_tokenSelector_idx" ON "EmailVerificationToken"("tokenSelector");
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");
CREATE INDEX "EmailVerificationToken_organizationId_idx" ON "EmailVerificationToken"("organizationId");

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex: User.phone — globally unique + dedicated lookup index
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- Backfill firstName/lastName from existing name (best-effort split on first space).
-- We keep them nullable in schema to avoid the "non-null without default on populated table" trap;
-- application code is the source of truth for required-on-write going forward.
UPDATE "User"
SET "firstName" = CASE
  WHEN position(' ' in "name") > 0 THEN split_part("name", ' ', 1)
  ELSE "name"
END,
"lastName" = CASE
  WHEN position(' ' in "name") > 0 THEN substring("name" from position(' ' in "name") + 1)
  ELSE ''
END
WHERE "firstName" IS NULL;

-- Existing dashboard staff are trusted (admin invited them) — mark email verified.
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL AND "email" IS NOT NULL;

-- RLS for EmailVerificationToken — mirrors the canonical pattern set by 20260425120000_saas_rls_hardening:
--   * suffixed policy name `tenant_isolation_<snake_case_table>`
--   * `app_current_org_id() IS NULL` super-admin / RlsHelper bypass
--   * USING + WITH CHECK so cross-tenant writes are blocked even if the Prisma extension is bypassed
ALTER TABLE "EmailVerificationToken" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_email_verification_token ON "EmailVerificationToken";
CREATE POLICY tenant_isolation_email_verification_token ON "EmailVerificationToken"
  USING      ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL)
  WITH CHECK ("organizationId"::uuid = app_current_org_id() OR app_current_org_id() IS NULL);
