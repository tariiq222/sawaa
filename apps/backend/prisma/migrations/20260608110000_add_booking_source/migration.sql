-- Booking origin (front desk vs public website).
--
-- 1. New BookingSource enum: RECEPTION (created by staff at the front desk) and
--    ONLINE (self-service booking from the public website).
-- 2. Add a non-null `source` column on Booking defaulting to RECEPTION — the
--    DEFAULT backfills every existing row to RECEPTION per the product decision.

CREATE TYPE "BookingSource" AS ENUM ('RECEPTION', 'ONLINE');

ALTER TABLE "Booking" ADD COLUMN "source" "BookingSource" NOT NULL DEFAULT 'RECEPTION';
