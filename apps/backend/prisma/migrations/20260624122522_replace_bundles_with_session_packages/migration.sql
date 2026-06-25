-- Replace the old ServiceBundle (sequential same-day) system with the new
-- session-package (credit pack) model. Destructive — owner approved; no live
-- data to preserve.

-- --------------------------------------------------------------
-- 1. Drop bundle-era CHECK constraints + Invoice XOR + bundle FKs/indexes.
-- --------------------------------------------------------------

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_booking_or_bundle_xor_chk";
ALTER TABLE "ServiceBundle" DROP CONSTRAINT IF EXISTS "ServiceBundle_discountValue_positive";
ALTER TABLE "BundlePurchase" DROP CONSTRAINT IF EXISTS "BundlePurchase_amountPaid_nonnegative_chk";
ALTER TABLE "BundlePurchase" DROP CONSTRAINT IF EXISTS "BundlePurchase_quantityTotal_nonnegative_chk";
ALTER TABLE "BundlePurchase" DROP CONSTRAINT IF EXISTS "BundlePurchase_quantityUsed_range_chk";
ALTER TABLE "BundleUsage" DROP CONSTRAINT IF EXISTS "BundleUsage_quantityUsed_positive_chk";

-- DropForeignKey
ALTER TABLE "BundleUsage" DROP CONSTRAINT IF EXISTS "BundleUsage_purchaseId_fkey";
ALTER TABLE "ServiceBundleItem" DROP CONSTRAINT IF EXISTS "ServiceBundleItem_bundleId_fkey";
ALTER TABLE "ServiceBundleItem" DROP CONSTRAINT IF EXISTS "ServiceBundleItem_serviceId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Booking_bundleGroupId_idx";
DROP INDEX IF EXISTS "Invoice_bundlePurchaseId_idx";
DROP INDEX IF EXISTS "Invoice_bundlePurchaseId_key";

-- --------------------------------------------------------------
-- 2. Booking: drop bundle columns, add packageCreditId.
-- --------------------------------------------------------------

ALTER TABLE "Booking" DROP COLUMN "bundleGroupId",
DROP COLUMN "bundleId",
ADD COLUMN     "packageCreditId" TEXT;

-- --------------------------------------------------------------
-- 3. Invoice: rename bundlePurchaseId -> packagePurchaseId.
-- --------------------------------------------------------------

ALTER TABLE "Invoice" RENAME COLUMN "bundlePurchaseId" TO "packagePurchaseId";

-- --------------------------------------------------------------
-- 4. Drop the old bundle tables + enum.
-- --------------------------------------------------------------

DROP TABLE "BundleUsage";
DROP TABLE "BundlePurchase";
DROP TABLE "ServiceBundleItem";
DROP TABLE "ServiceBundle";
DROP TYPE "BundlePurchaseStatus";

-- --------------------------------------------------------------
-- 5. Create the session-package enums.
-- --------------------------------------------------------------

-- CreateEnum
CREATE TYPE "PackagePurchaseStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PackageCreditUsageStatus" AS ENUM ('CONSUMED', 'RETURNED');

-- --------------------------------------------------------------
-- 6. Create the new session-package tables.
-- --------------------------------------------------------------

-- CreateTable
CREATE TABLE "SessionPackage" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "imageUrl" TEXT,
    "iconName" TEXT,
    "iconBgColor" TEXT,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "durationOptionId" TEXT NOT NULL,
    "paidQuantity" INTEGER NOT NULL,
    "freeQuantity" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackagePurchase" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "PackagePurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "subtotalSnapshot" DECIMAL(12,2) NOT NULL,
    "discountSnapshot" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackagePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageCredit" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "durationOptionId" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL(12,2) NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "usedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageCreditUsage" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "bookingId" TEXT,
    "status" "PackageCreditUsageStatus" NOT NULL DEFAULT 'CONSUMED',
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "PackageCreditUsage_pkey" PRIMARY KEY ("id")
);

-- --------------------------------------------------------------
-- 7. Indexes.
-- --------------------------------------------------------------

-- CreateIndex
CREATE INDEX "SessionPackage_isActive_idx" ON "SessionPackage"("isActive");

-- CreateIndex
CREATE INDEX "SessionPackage_isPublic_idx" ON "SessionPackage"("isPublic");

-- CreateIndex
CREATE INDEX "SessionPackageItem_packageId_idx" ON "SessionPackageItem"("packageId");

-- CreateIndex
CREATE INDEX "PackagePurchase_clientId_idx" ON "PackagePurchase"("clientId");

-- CreateIndex
CREATE INDEX "PackagePurchase_packageId_idx" ON "PackagePurchase"("packageId");

-- CreateIndex
CREATE INDEX "PackagePurchase_status_idx" ON "PackagePurchase"("status");

-- CreateIndex
CREATE INDEX "PackageCredit_purchaseId_idx" ON "PackageCredit"("purchaseId");

-- CreateIndex
CREATE INDEX "PackageCredit_serviceId_employeeId_durationOptionId_idx" ON "PackageCredit"("serviceId", "employeeId", "durationOptionId");

-- CreateIndex
CREATE INDEX "PackageCreditUsage_creditId_idx" ON "PackageCreditUsage"("creditId");

-- CreateIndex
CREATE INDEX "PackageCreditUsage_bookingId_idx" ON "PackageCreditUsage"("bookingId");

-- CreateIndex
CREATE INDEX "Booking_packageCreditId_idx" ON "Booking"("packageCreditId");

-- CreateIndex
CREATE INDEX "Invoice_packagePurchaseId_idx" ON "Invoice"("packagePurchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_packagePurchaseId_key" ON "Invoice"("packagePurchaseId");

-- --------------------------------------------------------------
-- 8. Foreign keys (within the bookings/org-experience clusters only).
-- --------------------------------------------------------------

-- AddForeignKey
ALTER TABLE "SessionPackageItem" ADD CONSTRAINT "SessionPackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SessionPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCredit" ADD CONSTRAINT "PackageCredit_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PackagePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCreditUsage" ADD CONSTRAINT "PackageCreditUsage_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "PackageCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------
-- 9. New domain CHECK constraints (mirroring the old bundle ones).
-- --------------------------------------------------------------

-- Invoice XOR: exactly ONE of bookingId OR packagePurchaseId must be non-null.
ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_booking_or_package_xor_chk"
    CHECK (num_nonnulls("bookingId", "packagePurchaseId") = 1);

-- SessionPackage discount must be non-negative.
ALTER TABLE "SessionPackage"
    ADD CONSTRAINT "SessionPackage_discountValue_nonnegative_chk"
    CHECK ("discountValue" >= 0);

-- SessionPackageItem quantities must be non-negative.
ALTER TABLE "SessionPackageItem"
    ADD CONSTRAINT "SessionPackageItem_quantities_nonnegative_chk"
    CHECK ("paidQuantity" >= 0 AND "freeQuantity" >= 0);

-- PackagePurchase money snapshots must be non-negative.
ALTER TABLE "PackagePurchase"
    ADD CONSTRAINT "PackagePurchase_amounts_nonnegative_chk"
    CHECK ("subtotalSnapshot" >= 0 AND "discountSnapshot" >= 0 AND "amountPaid" >= 0 AND "refundAmount" >= 0);

-- PackageCredit: non-negative price, and usedQuantity within [0, totalQuantity].
ALTER TABLE "PackageCredit"
    ADD CONSTRAINT "PackageCredit_quantities_chk"
    CHECK ("unitPriceSnapshot" >= 0 AND "totalQuantity" >= 0 AND "usedQuantity" >= 0 AND "usedQuantity" <= "totalQuantity");
