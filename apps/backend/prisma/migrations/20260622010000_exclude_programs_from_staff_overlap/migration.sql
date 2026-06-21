-- Program enrollment bookings carry ADVISORY scheduledAt/endsAt (a shared
-- far-future placeholder until the program is scheduled), so they must NOT
-- participate in the practitioner double-booking exclusion. Two unscheduled
-- programs that share a supervisor otherwise collide on the placeholder time.
-- Restrict the constraint to real (non-program) bookings.

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_staff_active_time_no_overlap";

ALTER TABLE "Booking"
ADD CONSTRAINT "booking_staff_active_time_no_overlap"
EXCLUDE USING gist (
  "employeeId" WITH =,
  tsrange("scheduledAt", "endsAt", '[)') WITH &&,
  (COALESCE("programId", id)) WITH <>
)
WHERE (
  "programId" IS NULL AND status IN (
    'PENDING',
    'PENDING_GROUP_FILL',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'CANCEL_REQUESTED',
    'DEPOSIT_PAID'
  )
);
