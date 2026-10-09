-- Additive only: phone-first mobile entry and verified client email.
ALTER TABLE "Client" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "Client" ADD COLUMN "emailPromptResolvedAt" TIMESTAMP(3);

CREATE TYPE "MobilePhoneFlowState" AS ENUM ('CODE_PENDING', 'DETAILS_PENDING', 'CONSUMED', 'FAILED');
CREATE TABLE "MobilePhoneEntryFlow" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "state" "MobilePhoneFlowState" NOT NULL,
  "codeHash" TEXT,
  "codeExpiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "continuationHash" TEXT,
  "continuationExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "MobilePhoneEntryFlow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MobilePhoneEntryFlow_continuationHash_key" ON "MobilePhoneEntryFlow"("continuationHash");
CREATE INDEX "MobilePhoneEntryFlow_phone_createdAt_idx" ON "MobilePhoneEntryFlow"("phone", "createdAt");
CREATE INDEX "MobilePhoneEntryFlow_codeExpiresAt_idx" ON "MobilePhoneEntryFlow"("codeExpiresAt");
CREATE INDEX "MobilePhoneEntryFlow_continuationExpiresAt_consumedAt_idx" ON "MobilePhoneEntryFlow"("continuationExpiresAt", "consumedAt");

CREATE TABLE "ClientEmailChallenge" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientEmailChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientEmailChallenge_clientId_consumedAt_idx" ON "ClientEmailChallenge"("clientId", "consumedAt");
CREATE INDEX "ClientEmailChallenge_expiresAt_idx" ON "ClientEmailChallenge"("expiresAt");
