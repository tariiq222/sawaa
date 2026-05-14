-- CreateEnum
CREATE TYPE "SuperAdminActionType" AS ENUM ('SUSPEND_ORG', 'REINSTATE_ORG', 'IMPERSONATE_START', 'IMPERSONATE_END', 'RESET_PASSWORD', 'PLAN_CREATE', 'PLAN_UPDATE', 'PLAN_DELETE', 'VERTICAL_CREATE', 'VERTICAL_UPDATE', 'VERTICAL_DELETE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "superAdminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedReason" TEXT,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminActionLog" (
    "id" TEXT NOT NULL,
    "superAdminUserId" TEXT NOT NULL,
    "actionType" "SuperAdminActionType" NOT NULL,
    "organizationId" TEXT,
    "impersonationSessionId" TEXT,
    "reason" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImpersonationSession_superAdminUserId_idx" ON "ImpersonationSession"("superAdminUserId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_targetUserId_idx" ON "ImpersonationSession"("targetUserId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_organizationId_idx" ON "ImpersonationSession"("organizationId");

-- CreateIndex
CREATE INDEX "ImpersonationSession_expiresAt_idx" ON "ImpersonationSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ImpersonationSession_endedAt_idx" ON "ImpersonationSession"("endedAt");

-- CreateIndex
CREATE INDEX "SuperAdminActionLog_superAdminUserId_idx" ON "SuperAdminActionLog"("superAdminUserId");

-- CreateIndex
CREATE INDEX "SuperAdminActionLog_actionType_idx" ON "SuperAdminActionLog"("actionType");

-- CreateIndex
CREATE INDEX "SuperAdminActionLog_organizationId_idx" ON "SuperAdminActionLog"("organizationId");

-- CreateIndex
CREATE INDEX "SuperAdminActionLog_impersonationSessionId_idx" ON "SuperAdminActionLog"("impersonationSessionId");

-- CreateIndex
CREATE INDEX "SuperAdminActionLog_createdAt_idx" ON "SuperAdminActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "User_isSuperAdmin_idx" ON "User"("isSuperAdmin");
