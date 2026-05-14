-- DB-10: Introduce ServiceBookingMode enum for ServiceBookingConfig.bookingType.
-- Replaces the plain String column storing 'in_person' | 'online' with a
-- typed PostgreSQL enum. Existing rows are normalised to uppercase before casting.

-- 1. Create the enum type.
CREATE TYPE "ServiceBookingMode" AS ENUM ('IN_PERSON', 'ONLINE');

-- 2. Normalise existing string values to match enum cases.
UPDATE "ServiceBookingConfig"
SET "bookingType" = CASE
  WHEN "bookingType" = 'in_person' THEN 'IN_PERSON'
  WHEN "bookingType" = 'online'    THEN 'ONLINE'
  ELSE UPPER(REPLACE("bookingType", ' ', '_'))
END;

-- 3. Change column type, casting the now-normalised strings to the enum.
ALTER TABLE "ServiceBookingConfig"
  ALTER COLUMN "bookingType" TYPE "ServiceBookingMode"
  USING "bookingType"::"ServiceBookingMode";
