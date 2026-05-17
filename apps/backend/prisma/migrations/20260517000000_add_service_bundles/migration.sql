-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "bundleGroupId" TEXT,
ADD COLUMN     "bundleId" TEXT;

-- CreateTable
CREATE TABLE "ServiceBundle" (
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
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceBundleItem" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceBundleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceBundle_isActive_idx" ON "ServiceBundle"("isActive");

-- CreateIndex
CREATE INDEX "ServiceBundle_isHidden_idx" ON "ServiceBundle"("isHidden");

-- CreateIndex
CREATE INDEX "ServiceBundleItem_bundleId_idx" ON "ServiceBundleItem"("bundleId");

-- CreateIndex
CREATE INDEX "ServiceBundleItem_serviceId_idx" ON "ServiceBundleItem"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceBundleItem_bundleId_serviceId_key" ON "ServiceBundleItem"("bundleId", "serviceId");

-- CreateIndex
CREATE INDEX "Booking_bundleGroupId_idx" ON "Booking"("bundleGroupId");

-- AddForeignKey
ALTER TABLE "ServiceBundleItem" ADD CONSTRAINT "ServiceBundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "ServiceBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceBundleItem" ADD CONSTRAINT "ServiceBundleItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK constraint: discountValue must be non-negative
ALTER TABLE "ServiceBundle" ADD CONSTRAINT "ServiceBundle_discountValue_positive" CHECK ("discountValue" >= 0);
