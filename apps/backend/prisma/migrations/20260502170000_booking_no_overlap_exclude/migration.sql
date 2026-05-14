-- Migration: DB-02 — prevent employee double-booking at the DB layer.
-- Uses btree_gist extension + partial GIST EXCLUDE constraint.
-- Constraint covers PENDING, CONFIRMED, AWAITING_PAYMENT bookings
-- for non-GROUP bookingTypes only.
--
-- Note: scheduledAt/endsAt are stored as `timestamp` (without timezone).
-- We therefore use tsrange (not tstzrange). btree_gist is required so
-- that a plain-equality operator (=) on the text employeeId column is
-- usable inside a GIST index.

-- 1. Install extension (idempotent)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add the EXCLUDE constraint.
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_employee_no_overlap
  EXCLUDE USING GIST (
    "employeeId" WITH =,
    tsrange("scheduledAt", "endsAt", '[)') WITH &&
  )
  WHERE (
    status IN ('PENDING', 'CONFIRMED', 'AWAITING_PAYMENT')
    AND "bookingType" != 'GROUP'
  );
