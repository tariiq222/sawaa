/*
  Warnings:

  - Add organizationId to OtpCode and UsedOtpSession for cross-org scoping.
  - Add indexes for performance and security.
*/

-- AlterTable
ALTER TABLE "OtpCode" ADD COLUMN "organizationId" TEXT;

-- AlterTable
ALTER TABLE "UsedOtpSession" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "OtpCode_organizationId_identifier_channel_purpose_idx" ON "OtpCode"("organizationId", "identifier", "channel", "purpose");

-- CreateIndex
CREATE INDEX "UsedOtpSession_organizationId_idx" ON "UsedOtpSession"("organizationId");
