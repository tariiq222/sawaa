-- ============================================================
-- Migration: add_delivery_type_and_bundles
-- Purpose: Separate DeliveryType from BookingType; add bundle
--          lifecycle tables; add booking snapshot fields;
--          prepare Invoice for XOR (Booking OR BundlePurchase).
-- ============================================================

-- --------------------------------------------------------------
-- 1. Enums
-- --------------------------------------------------------------

-- Delivery channel — independent from BookingType.
-- IN_PERSON = physically at the branch; ONLINE = virtual.
CREATE TYPE "DeliveryType" AS ENUM ('IN_PERSON', 'ONLINE');

-- Bundle purchase lifecycle status.
CREATE TYPE "BundlePurchaseStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- --------------------------------------------------------------
-- 2. Booking snapshot fields + deliveryType
-- --------------------------------------------------------------

ALTER TABLE "Booking"
    ADD COLUMN "deliveryType" "DeliveryType",
    ADD COLUMN "priceSnapshot" DECIMAL(12,2),
    ADD COLUMN "durationMinutesSnapshot" INTEGER,
    ADD COLUMN "branchNameSnapshot" TEXT,
    ADD COLUMN "employeeNameSnapshot" TEXT,
    ADD COLUMN "serviceNameSnapshot" TEXT,
    ADD COLUMN "categoryNameSnapshot" TEXT,
    ADD COLUMN "departmentNameSnapshot" TEXT;

-- --------------------------------------------------------------
-- 3. Organization models — deliveryType
-- --------------------------------------------------------------

ALTER TABLE "ServiceBookingConfig"
    ADD COLUMN "deliveryType" "DeliveryType";

ALTER TABLE "ServiceDurationOption"
    ADD COLUMN "deliveryType" "DeliveryType";

ALTER TABLE "EmployeeServiceOption"
    ADD COLUMN "deliveryType" "DeliveryType";

-- --------------------------------------------------------------
-- 4. GroupSession — deliveryType
-- --------------------------------------------------------------

ALTER TABLE "GroupSession"
    ADD COLUMN "deliveryType" "DeliveryType";

-- --------------------------------------------------------------
-- 5. Invoice — support bundle purchases (XOR with bookingId)
-- --------------------------------------------------------------

ALTER TABLE "Invoice"
    ADD COLUMN "bundlePurchaseId" TEXT,
    ALTER COLUMN "bookingId" DROP NOT NULL;

-- Unique constraints: one invoice per booking, one per bundle purchase.
-- PostgreSQL unique indexes allow multiple NULLs, so nullable fields work.
CREATE UNIQUE INDEX "Invoice_bundlePurchaseId_key" ON "Invoice"("bundlePurchaseId");

-- NOTE: The existing "Invoice_bookingId_key" unique index remains.
-- It was created by a prior migration and continues to enforce
-- one-invoice-per-booking for non-null values.

-- Query index for bundle invoice lookups.
CREATE INDEX "Invoice_bundlePurchaseId_idx" ON "Invoice"("bundlePurchaseId");

-- --------------------------------------------------------------
-- 6. BundlePurchase table
-- --------------------------------------------------------------

CREATE TABLE "BundlePurchase" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "status" "BundlePurchaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "quantityTotal" INTEGER NOT NULL DEFAULT 0,
    "quantityUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundlePurchase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BundlePurchase_clientId_idx" ON "BundlePurchase"("clientId");
CREATE INDEX "BundlePurchase_bundleId_idx" ON "BundlePurchase"("bundleId");
CREATE INDEX "BundlePurchase_status_idx" ON "BundlePurchase"("status");

-- --------------------------------------------------------------
-- 7. BundleUsage table
-- --------------------------------------------------------------

CREATE TABLE "BundleUsage" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "bookingId" TEXT,
    "serviceId" TEXT NOT NULL,
    "deliveryType" "DeliveryType" NOT NULL,
    "quantityUsed" INTEGER NOT NULL DEFAULT 1,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleUsage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BundleUsage_purchaseId_idx" ON "BundleUsage"("purchaseId");
CREATE INDEX "BundleUsage_bookingId_idx" ON "BundleUsage"("bookingId");
CREATE INDEX "BundleUsage_serviceId_idx" ON "BundleUsage"("serviceId");

-- --------------------------------------------------------------
-- 8. Foreign keys
-- --------------------------------------------------------------

ALTER TABLE "BundleUsage"
    ADD CONSTRAINT "BundleUsage_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "BundlePurchase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------
-- 9. Backfill guide (run as separate step after deployment)
-- --------------------------------------------------------------
/*
-- Backfill Booking.deliveryType from existing data:
UPDATE "Booking"
SET "deliveryType" = 'ONLINE'
WHERE "bookingType" = 'ONLINE'
   OR "zoomJoinUrl" IS NOT NULL
   OR "zoomMeetingId" IS NOT NULL;

UPDATE "Booking"
SET "deliveryType" = 'IN_PERSON'
WHERE "deliveryType" IS NULL;

-- Backfill ServiceBookingConfig.deliveryType:
UPDATE "ServiceBookingConfig"
SET "deliveryType" = CASE
    WHEN "bookingType" = 'ONLINE'::"ServiceBookingMode" THEN 'ONLINE'::"DeliveryType"
    ELSE 'IN_PERSON'::"DeliveryType"
END;

-- Backfill ServiceDurationOption.deliveryType:
UPDATE "ServiceDurationOption"
SET "deliveryType" = CASE
    WHEN "bookingType" = 'ONLINE' THEN 'ONLINE'::"DeliveryType"
    ELSE 'IN_PERSON'::"DeliveryType"
END
WHERE "bookingType" IS NOT NULL;

-- For ServiceDurationOption with NULL bookingType (applies to all),
-- duplicate the row for both IN_PERSON and ONLINE after backfill
-- if the service supports both delivery types. This requires app logic.

-- Backfill EmployeeServiceOption.deliveryType from linked duration option:
UPDATE "EmployeeServiceOption" eo
SET "deliveryType" = do."deliveryType"
FROM "ServiceDurationOption" do
WHERE eo."durationOptionId" = do."id"
  AND eo."deliveryType" IS NULL;

-- Backfill GroupSession.deliveryType:
UPDATE "GroupSession"
SET "deliveryType" = 'ONLINE'
WHERE "zoomJoinUrl" IS NOT NULL OR "zoomMeetingId" IS NOT NULL;

UPDATE "GroupSession"
SET "deliveryType" = 'IN_PERSON'
WHERE "deliveryType" IS NULL;
*/

-- --------------------------------------------------------------
-- 10. Validation queries (run before making fields non-nullable)
-- --------------------------------------------------------------
/*
-- Verify no NULL deliveryType remains in Booking:
SELECT COUNT(*) FROM "Booking" WHERE "deliveryType" IS NULL;

-- Verify no NULL deliveryType remains in ServiceBookingConfig:
SELECT COUNT(*) FROM "ServiceBookingConfig" WHERE "deliveryType" IS NULL;

-- Verify no NULL deliveryType remains in ServiceDurationOption:
SELECT COUNT(*) FROM "ServiceDurationOption" WHERE "deliveryType" IS NULL;

-- Verify no NULL deliveryType remains in EmployeeServiceOption:
SELECT COUNT(*) FROM "EmployeeServiceOption" WHERE "deliveryType" IS NULL;

-- Verify XOR on Invoice (exactly one of bookingId / bundlePurchaseId is non-null):
SELECT COUNT(*) FROM "Invoice"
WHERE ("bookingId" IS NULL AND "bundlePurchaseId" IS NULL)
   OR ("bookingId" IS NOT NULL AND "bundlePurchaseId" IS NOT NULL);

-- Verify no duplicate bundlePurchaseId values exist:
SELECT "bundlePurchaseId", COUNT(*)
FROM "Invoice"
WHERE "bundlePurchaseId" IS NOT NULL
GROUP BY "bundlePurchaseId"
HAVING COUNT(*) > 1;
*/

-- --------------------------------------------------------------
-- 11. Future unique constraints (apply after backfill)
-- --------------------------------------------------------------
/*
-- ServiceBookingConfig: (serviceId, deliveryType)
-- ALTER TABLE "ServiceBookingConfig" DROP CONSTRAINT "ServiceBookingConfig_serviceId_bookingType_key";
-- CREATE UNIQUE INDEX "ServiceBookingConfig_serviceId_deliveryType_key" ON "ServiceBookingConfig"("serviceId", "deliveryType");

-- EmployeeServiceOption: (employeeServiceId, durationOptionId, deliveryType)
-- ALTER TABLE "EmployeeServiceOption" DROP CONSTRAINT "EmployeeServiceOption_employeeServiceId_durationOptionId_key";
-- CREATE UNIQUE INDEX "EmployeeServiceOption_employeeServiceId_durationOptionId_del_key" ON "EmployeeServiceOption"("employeeServiceId", "durationOptionId", "deliveryType");
*/
