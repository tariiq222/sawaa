CREATE TYPE "MobileEmailFlowState" AS ENUM ('EMAIL_SENDING', 'EMAIL_PENDING', 'DETAILS_PENDING', 'PHONE_SENDING', 'PHONE_PENDING', 'CONSUMED', 'FAILED');
CREATE TYPE "MobileEmailFlowMode" AS ENUM ('REGISTER', 'LINK_PHONE');
CREATE TABLE "MobileEmailFlow" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "state" "MobileEmailFlowState" NOT NULL,
  "emailCodeHash" TEXT,
  "emailExpiresAt" TIMESTAMP(3) NOT NULL,
  "emailAttempts" INTEGER NOT NULL DEFAULT 0,
  "continuationHash" TEXT,
  "continuationExpiresAt" TIMESTAMP(3),
  "mode" "MobileEmailFlowMode",
  "boundUserId" TEXT,
  "boundClientId" TEXT,
  "identitySnapshot" JSONB,
  "phone" TEXT,
  "firstName" TEXT,
  "lastName" TEXT,
  "privacyAcceptedAt" TIMESTAMP(3),
  "phoneMatchAttempts" INTEGER NOT NULL DEFAULT 0,
  "phoneChallengeId" TEXT,
  "phoneCodeHash" TEXT,
  "phoneExpiresAt" TIMESTAMP(3),
  "phoneAttempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "MobileEmailFlow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MobileEmailFlow_continuationHash_key" ON "MobileEmailFlow"("continuationHash");
CREATE UNIQUE INDEX "MobileEmailFlow_phoneChallengeId_key" ON "MobileEmailFlow"("phoneChallengeId");
CREATE INDEX "MobileEmailFlow_email_createdAt_idx" ON "MobileEmailFlow"("email", "createdAt");
CREATE INDEX "MobileEmailFlow_emailExpiresAt_idx" ON "MobileEmailFlow"("emailExpiresAt");
CREATE INDEX "MobileEmailFlow_continuationExpiresAt_consumedAt_idx" ON "MobileEmailFlow"("continuationExpiresAt", "consumedAt");
