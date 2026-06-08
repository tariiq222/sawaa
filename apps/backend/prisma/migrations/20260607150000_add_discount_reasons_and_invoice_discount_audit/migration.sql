-- Manual invoice discounts: admin-managed reasons + audit trail on Invoice.
--
-- 1. DiscountReason — admin-managed list of reasons for a manual discount
--    (e.g. "خصم من المعالج", "خصم خاص", "خصم من سواء"). Managed from settings.
-- 2. Invoice gains a discount audit trail: which reason, who applied it, when.
--    The amount itself reuses the existing Invoice.discountAmt column.
--    discountReasonId is a plain string id (no FK) — DiscountReason lives in the
--    organization cluster while Invoice lives in finance; cross-cluster ids are
--    not modelled as Prisma relations per the BC conventions.

-- ─── DiscountReason ─────────────────────────────────────────────────────────────
CREATE TABLE "DiscountReason" (
    "id" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "labelEn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountReason_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscountReason_isActive_idx" ON "DiscountReason"("isActive");

-- ─── Invoice discount audit trail ──────────────────────────────────────────────
ALTER TABLE "Invoice" ADD COLUMN "discountReasonId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "discountAppliedBy" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "discountAppliedAt" TIMESTAMP(3);
