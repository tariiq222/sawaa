-- SaaS-05c — Admin billing oversight
-- Additive only: enum extensions, 3 cols on SubscriptionInvoice, new BillingCredit table.
-- Rollback (manual): DROP TABLE "BillingCredit";
--                    ALTER TABLE "SubscriptionInvoice" DROP COLUMN "refundedAmount", "refundedAt", "voidedReason";
--                    Postgres enums cannot drop values — leave enum extensions in place.

-- 1) Extend SuperAdminActionType enum
ALTER TYPE "SuperAdminActionType" ADD VALUE 'BILLING_REFUND';
ALTER TYPE "SuperAdminActionType" ADD VALUE 'BILLING_WAIVE_INVOICE';
ALTER TYPE "SuperAdminActionType" ADD VALUE 'BILLING_GRANT_CREDIT';
ALTER TYPE "SuperAdminActionType" ADD VALUE 'BILLING_CHANGE_PLAN';
ALTER TYPE "SuperAdminActionType" ADD VALUE 'BILLING_FORCE_CHARGE';

-- 2) SubscriptionInvoice — refund / waive bookkeeping
ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN "refundedAmount" DECIMAL(12, 2),
  ADD COLUMN "refundedAt"     TIMESTAMP(3),
  ADD COLUMN "voidedReason"   TEXT;

-- 3) BillingCredit — credit granted by super-admin, applied against next invoice
CREATE TABLE "BillingCredit" (
    "id"                TEXT         NOT NULL,
    "organizationId"    TEXT         NOT NULL,
    "amount"            DECIMAL(12, 2) NOT NULL,
    "currency"          TEXT         NOT NULL DEFAULT 'SAR',
    "reason"            TEXT         NOT NULL,
    "grantedByUserId"   TEXT         NOT NULL,
    "grantedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedInvoiceId" TEXT,
    "consumedAt"        TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingCredit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BillingCredit_organizationId_consumedAt_idx" ON "BillingCredit"("organizationId", "consumedAt");
CREATE INDEX "BillingCredit_grantedByUserId_idx" ON "BillingCredit"("grantedByUserId");
