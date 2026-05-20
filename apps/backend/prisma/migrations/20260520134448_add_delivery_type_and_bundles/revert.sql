-- ============================================================
-- Revert: add_delivery_type_and_bundles
-- ============================================================

-- Drop foreign keys first
ALTER TABLE "BundleUsage" DROP CONSTRAINT IF EXISTS "BundleUsage_purchaseId_fkey";

-- Drop tables
DROP TABLE IF EXISTS "BundleUsage";
DROP TABLE IF EXISTS "BundlePurchase";

-- Drop indexes on Invoice
DROP INDEX IF EXISTS "Invoice_bundlePurchaseId_idx";
DROP INDEX IF EXISTS "Invoice_bundlePurchaseId_key";

-- Revert Invoice columns
ALTER TABLE "Invoice" DROP COLUMN IF EXISTS "bundlePurchaseId";
ALTER TABLE "Invoice" ALTER COLUMN "bookingId" SET NOT NULL;

-- Drop columns from GroupSession
ALTER TABLE "GroupSession" DROP COLUMN IF EXISTS "deliveryType";

-- Drop columns from organization models
ALTER TABLE "EmployeeServiceOption" DROP COLUMN IF EXISTS "deliveryType";
ALTER TABLE "ServiceDurationOption" DROP COLUMN IF EXISTS "deliveryType";
ALTER TABLE "ServiceBookingConfig" DROP COLUMN IF EXISTS "deliveryType";

-- Drop columns from Booking
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "departmentNameSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "categoryNameSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "serviceNameSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "employeeNameSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "branchNameSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "durationMinutesSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "priceSnapshot";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "deliveryType";

-- Drop enums
DROP TYPE IF EXISTS "BundlePurchaseStatus";
DROP TYPE IF EXISTS "DeliveryType";
