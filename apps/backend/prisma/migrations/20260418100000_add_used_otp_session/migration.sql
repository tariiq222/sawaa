-- CreateTable
CREATE TABLE "UsedOtpSession" (
    "jti" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsedOtpSession_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "UsedOtpSession_expiresAt_idx" ON "UsedOtpSession"("expiresAt");
