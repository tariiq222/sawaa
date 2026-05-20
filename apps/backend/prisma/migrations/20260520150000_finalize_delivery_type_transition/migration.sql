-- ============================================================
-- Migration: finalize_delivery_type_transition
-- Purpose: Make deliveryType the required delivery-channel field,
--          remove legacy ONLINE from BookingType, drop legacy
--          service booking mode columns, and enforce invoice XOR.
-- ============================================================

-- --------------------------------------------------------------
-- 1. Backfill deliveryType from legacy fields before constraints.
-- --------------------------------------------------------------

UPDATE "Booking"
SET "deliveryType" = CASE
    WHEN "bookingType" = 'ONLINE'::"BookingType"
      OR "zoomJoinUrl" IS NOT NULL
      OR "zoomMeetingId" IS NOT NULL
    THEN 'ONLINE'::"DeliveryType"
    ELSE 'IN_PERSON'::"DeliveryType"
END
WHERE "deliveryType" IS NULL;

UPDATE "Booking"
SET "bookingType" = 'INDIVIDUAL'::"BookingType"
WHERE "bookingType" = 'ONLINE'::"BookingType";

UPDATE "GroupSession"
SET "deliveryType" = 'IN_PERSON'::"DeliveryType"
WHERE "deliveryType" IS NULL;

UPDATE "ServiceBookingConfig"
SET "deliveryType" = CASE
    WHEN "bookingType" = 'ONLINE'::"ServiceBookingMode" THEN 'ONLINE'::"DeliveryType"
    ELSE 'IN_PERSON'::"DeliveryType"
END
WHERE "deliveryType" IS NULL;

UPDATE "ServiceDurationOption"
SET "deliveryType" = CASE
    WHEN "bookingType" = 'ONLINE'::"BookingType" THEN 'ONLINE'::"DeliveryType"
    ELSE 'IN_PERSON'::"DeliveryType"
END
WHERE "deliveryType" IS NULL
  AND "bookingType" IS NOT NULL;

WITH single_active_config AS (
    SELECT sdo."id", MIN(sbc."deliveryType"::text)::"DeliveryType" AS "inferredDeliveryType"
    FROM "ServiceDurationOption" sdo
    JOIN "ServiceBookingConfig" sbc
      ON sbc."serviceId" = sdo."serviceId"
    WHERE sdo."deliveryType" IS NULL
      AND sdo."bookingType" IS NULL
      AND sbc."isActive" = true
      AND sbc."deliveryType" IS NOT NULL
    GROUP BY sdo."id"
    HAVING COUNT(DISTINCT sbc."deliveryType") = 1
)
UPDATE "ServiceDurationOption" sdo
SET "deliveryType" = single_active_config."inferredDeliveryType"
FROM single_active_config
WHERE sdo."id" = single_active_config."id";

UPDATE "ServiceDurationOption"
SET "deliveryType" = 'IN_PERSON'::"DeliveryType"
WHERE "deliveryType" IS NULL;

UPDATE "EmployeeServiceOption" eso
SET "deliveryType" = sdo."deliveryType"
FROM "ServiceDurationOption" sdo
WHERE eso."durationOptionId" = sdo."id"
  AND eso."deliveryType" IS NULL;

-- --------------------------------------------------------------
-- 2. Remove legacy service booking fields and replace indexes.
-- --------------------------------------------------------------

DROP INDEX IF EXISTS "ServiceBookingConfig_serviceId_bookingType_key";
DROP INDEX IF EXISTS "ServiceDurationOption_serviceId_bookingType_idx";
DROP INDEX IF EXISTS "EmployeeServiceOption_employeeServiceId_durationOptionId_key";

ALTER TABLE "ServiceBookingConfig"
    DROP COLUMN "bookingType",
    ALTER COLUMN "deliveryType" SET NOT NULL;

ALTER TABLE "ServiceDurationOption"
    DROP COLUMN "bookingType",
    ALTER COLUMN "deliveryType" SET NOT NULL;

ALTER TABLE "EmployeeServiceOption"
    ALTER COLUMN "deliveryType" SET NOT NULL;

DROP TYPE "ServiceBookingMode";

-- Index strategy:
-- - ServiceBookingConfig is one config per service+delivery channel.
-- - ServiceDurationOption intentionally allows multiple durations per service+delivery channel.
-- - EmployeeServiceOption uniqueness includes deliveryType to match the final resolver key.
CREATE UNIQUE INDEX "ServiceBookingConfig_serviceId_deliveryType_key"
    ON "ServiceBookingConfig"("serviceId", "deliveryType");

CREATE INDEX "ServiceDurationOption_serviceId_deliveryType_idx"
    ON "ServiceDurationOption"("serviceId", "deliveryType");

CREATE UNIQUE INDEX "EmployeeServiceOption_employee_duration_delivery_key"
    ON "EmployeeServiceOption"("employeeServiceId", "durationOptionId", "deliveryType");

-- Optional data-quality guard: at most one active default duration per service+deliveryType.
-- The index is created only when existing data is clean, so production migration
-- is not blocked by historical duplicate defaults.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "ServiceDurationOption"
        WHERE "isDefault" = true
          AND "isActive" = true
        GROUP BY "serviceId", "deliveryType"
        HAVING COUNT(*) > 1
    ) THEN
        CREATE UNIQUE INDEX "ServiceDurationOption_one_default_active_delivery_idx"
            ON "ServiceDurationOption"("serviceId", "deliveryType")
            WHERE "isDefault" = true AND "isActive" = true;
    ELSE
        RAISE NOTICE 'Skipped ServiceDurationOption_one_default_active_delivery_idx because duplicate active defaults already exist.';
    END IF;
END $$;

-- --------------------------------------------------------------
-- 3. Make deliveryType required on booking tables.
-- --------------------------------------------------------------

ALTER TABLE "Booking"
    ALTER COLUMN "deliveryType" SET NOT NULL;

ALTER TABLE "GroupSession"
    ALTER COLUMN "deliveryType" SET NOT NULL;

-- --------------------------------------------------------------
-- 4. Rebuild BookingType enum without ONLINE.
-- --------------------------------------------------------------

ALTER TABLE "Booking"
    ALTER COLUMN "bookingType" DROP DEFAULT;

ALTER TYPE "BookingType" RENAME TO "BookingType_old";
CREATE TYPE "BookingType" AS ENUM ('INDIVIDUAL', 'WALK_IN', 'GROUP');

ALTER TABLE "Booking"
    ALTER COLUMN "bookingType" TYPE "BookingType"
    USING "bookingType"::text::"BookingType";

ALTER TABLE "Booking"
    ALTER COLUMN "bookingType" SET DEFAULT 'INDIVIDUAL'::"BookingType";

DROP TYPE "BookingType_old";

-- --------------------------------------------------------------
-- 5. Enforce Invoice XOR: exactly one source object per invoice.
-- --------------------------------------------------------------

ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_booking_or_bundle_xor_chk"
    CHECK (num_nonnulls("bookingId", "bundlePurchaseId") = 1);
