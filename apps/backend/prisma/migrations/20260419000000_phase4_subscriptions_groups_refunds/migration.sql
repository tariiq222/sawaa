-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'DENIED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionBenefitType" AS ENUM ('DISCOUNT_PERCENT', 'DISCOUNT_FIXED', 'SESSION_CREDITS', 'FREE_SESSIONS');

-- AlterTable
ALTER TABLE "ClientRefreshToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GroupSession" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicDescriptionAr" TEXT,
ADD COLUMN     "publicDescriptionEn" TEXT,
ADD COLUMN     "waitlistCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waitlistEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "GroupSessionWaitlist" (
    "id" TEXT NOT NULL,
    "groupSessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSessionWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "denialReason" TEXT,
    "gatewayRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "benefits" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUsage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientSubscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "benefitsUsed" INTEGER NOT NULL DEFAULT 0,
    "maxBenefits" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "invoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupSessionWaitlist_groupSessionId_idx" ON "GroupSessionWaitlist"("groupSessionId");

-- CreateIndex
CREATE INDEX "GroupSessionWaitlist_clientId_idx" ON "GroupSessionWaitlist"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupSessionWaitlist_groupSessionId_clientId_key" ON "GroupSessionWaitlist"("groupSessionId", "clientId");

-- CreateIndex
CREATE INDEX "RefundRequest_clientId_idx" ON "RefundRequest"("clientId");

-- CreateIndex
CREATE INDEX "RefundRequest_invoiceId_idx" ON "RefundRequest"("invoiceId");

-- CreateIndex
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_branchId_idx" ON "SubscriptionPlan"("branchId");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_isPublic_idx" ON "SubscriptionPlan"("isPublic");

-- CreateIndex
CREATE INDEX "ClientSubscription_clientId_idx" ON "ClientSubscription"("clientId");

-- CreateIndex
CREATE INDEX "ClientSubscription_planId_idx" ON "ClientSubscription"("planId");

-- CreateIndex
CREATE INDEX "ClientSubscription_status_idx" ON "ClientSubscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientRefreshToken_tokenHash_key" ON "ClientRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "GroupSession_isPublic_idx" ON "GroupSession"("isPublic");

-- AddForeignKey
ALTER TABLE "GroupSessionWaitlist" ADD CONSTRAINT "GroupSessionWaitlist_groupSessionId_fkey" FOREIGN KEY ("groupSessionId") REFERENCES "GroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientSubscription" ADD CONSTRAINT "ClientSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
