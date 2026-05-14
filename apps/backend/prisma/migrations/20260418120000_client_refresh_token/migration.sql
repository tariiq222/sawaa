-- Create ClientRefreshToken table for client auth refresh tokens
CREATE TABLE "ClientRefreshToken" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "clientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenSelector" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientRefreshToken_clientId_idx" ON "ClientRefreshToken"("clientId");
CREATE INDEX "ClientRefreshToken_tokenSelector_idx" ON "ClientRefreshToken"("tokenSelector");
