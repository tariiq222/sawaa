CREATE EXTENSION IF NOT EXISTS btree_gist;

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
    'CANCEL_REQUESTED'
  )
);
