-- Add client auth fields: password hash, loginAttempts, lockoutUntil, lastLoginAt
-- Also adds index on phone for guest-to-account linking lookup

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Client" ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Client" ADD COLUMN "lockoutUntil" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");
