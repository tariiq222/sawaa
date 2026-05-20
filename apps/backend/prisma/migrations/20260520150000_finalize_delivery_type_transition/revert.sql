-- ============================================================
-- Revert: finalize_delivery_type_transition
-- Purpose: Restore legacy booking/service mode columns and relax
--          deliveryType nullability. This is intended for emergency
--          rollback of schema shape; data mapped from ONLINE bookingType
--          to deliveryType remains lossy after the forward migration.
-- ============================================================

ALTER TABLE "Invoice"
    DROP CONSTRAINT IF EXISTS "Invoice_booking_or_bundle_xor_chk";

ALTER TYPE "BookingType" ADD VALUE IF NOT EXISTS 'ONLINE';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ServiceBookingMode') THEN
        CREATE TYPE "ServiceBookingMode" AS ENUM ('IN_PERSON', 'ONLINE');
    END IF;
END $$;

DROP INDEX IF EXISTS "ServiceDurationOption_one_default_active_delivery_idx";
DROP INDEX IF EXISTS "EmployeeServiceOption_employee_duration_delivery_key";
DROP INDEX IF EXISTS "ServiceDurationOption_serviceId_deliveryType_idx";
DROP INDEX IF EXISTS "ServiceBookingConfig_serviceId_deliveryType_key";

ALTER TABLE "Booking"
    ALTER COLUMN "deliveryType" DROP NOT NULL;

ALTER TABLE "GroupSession"
    ALTER COLUMN "deliveryType" DROP NOT NULL;

ALTER TABLE "ServiceBookingConfig"
    ADD COLUMN IF NOT EXISTS "bookingType" "ServiceBookingMode",
    ALTER COLUMN "deliveryType" DROP NOT NULL;

UPDATE "ServiceBookingConfig"
SET "bookingType" = CASE
    WHEN "deliveryType" = 'ONLINE'::"DeliveryType" THEN 'ONLINE'::"ServiceBookingMode"
    ELSE 'IN_PERSON'::"ServiceBookingMode"
END
WHERE "bookingType" IS NULL;

ALTER TABLE "ServiceBookingConfig"
    ALTER COLUMN "bookingType" SET NOT NULL;

ALTER TABLE "ServiceDurationOption"
    ADD COLUMN IF NOT EXISTS "bookingType" "BookingType",
    ALTER COLUMN "deliveryType" DROP NOT NULL;

UPDATE "ServiceDurationOption"
SET "bookingType" = CASE
    WHEN "deliveryType" = 'ONLINE'::"DeliveryType" THEN 'ONLINE'::"BookingType"
    ELSE 'INDIVIDUAL'::"BookingType"
END
WHERE "bookingType" IS NULL;

ALTER TABLE "EmployeeServiceOption"
    ALTER COLUMN "deliveryType" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceBookingConfig_serviceId_bookingType_key"
    ON "ServiceBookingConfig"("serviceId", "bookingType");

CREATE INDEX IF NOT EXISTS "ServiceDurationOption_serviceId_bookingType_idx"
    ON "ServiceDurationOption"("serviceId", "bookingType");

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeServiceOption_employeeServiceId_durationOptionId_key"
    ON "EmployeeServiceOption"("employeeServiceId", "durationOptionId");
