-- Fix: DEPOSIT_PAID was added to the BookingStatus enum (migration 20260608233000)
-- after this exclusion constraint was created (migration 20260606143000).
-- The application code (active-booking-statuses.ts STAFF_TIME_BLOCKING_BOOKING_STATUSES)
-- treats DEPOSIT_PAID as a time-blocking status, but the DB constraint did not reflect this,
-- allowing overlapping bookings with DEPOSIT_PAID status.
--
-- Strategy: DROP the existing constraint and re-ADD it with DEPOSIT_PAID included.
-- The re-creation will succeed because dev DB has 0 rows with DEPOSIT_PAID status.

ALTER TABLE "Booking"
DROP CONSTRAINT "booking_staff_active_time_no_overlap";

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_staff_active_time_no_overlap"
EXCLUDE USING gist (
  "employeeId" WITH =,
  tsrange("scheduledAt", "endsAt", '[)') WITH &&,
  (COALESCE("groupSessionId", id)) WITH <>
)
WHERE (
  status IN (
    'PENDING',
    'PENDING_GROUP_FILL',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'CANCEL_REQUESTED',
    'DEPOSIT_PAID'
  )
);
