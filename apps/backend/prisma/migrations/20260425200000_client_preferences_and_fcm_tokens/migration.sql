-- Client preferences
ALTER TABLE "Client"
  ADD COLUMN "preferredLocale" VARCHAR(8),
  ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT true;

-- FCM tokens (tenant-scoped)
CREATE TABLE "FcmToken" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" VARCHAR(8) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FcmToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fcm_token_per_client" ON "FcmToken"("clientId", "token");
CREATE INDEX "FcmToken_organizationId_idx" ON "FcmToken"("organizationId");
CREATE INDEX "FcmToken_clientId_idx" ON "FcmToken"("clientId");
