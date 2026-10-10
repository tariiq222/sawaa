-- Additive only: verified phone change for an authenticated client.
CREATE TABLE "ClientPhoneChallenge" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientPhoneChallenge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClientPhoneChallenge_clientId_consumedAt_idx" ON "ClientPhoneChallenge"("clientId", "consumedAt");
CREATE INDEX "ClientPhoneChallenge_expiresAt_idx" ON "ClientPhoneChallenge"("expiresAt");
