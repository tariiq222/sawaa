-- Close the practitioner double-booking hole at the DB level (prod incident 2026-06-24).
--
-- complete-booking / no-show-booking have no time guard, so staff can finalize a
-- booking before its scheduled time. The app blocking set
-- (active-booking-statuses.ts STAFF_TIME_BLOCKING_BOOKING_STATUSES) now includes
-- COMPLETED and NO_SHOW, but this exclusion constraint still released those slots,
-- letting a future-dated finalized booking be double-booked if the app check is
-- ever bypassed (race / direct insert). Bring the DB backstop in line with the app.
--
-- PRECONDITION (run in prod BEFORE deploying this migration): there must be NO
-- existing overlapping pairs for the widened status set, or ADD CONSTRAINT fails and
-- the boot-time `prisma migrate deploy` aborts. Detection query:
--
--   SELECT a.id, a.status, a."scheduledAt", b.id, b.status, b."scheduledAt", a."employeeId"
--   FROM "Booking" a
--   JOIN "Booking" b
--     ON a."employeeId" = b."employeeId" AND a.id < b.id
--    AND a."programId" IS NULL AND b."programId" IS NULL
--    AND tsrange(a."scheduledAt", a."endsAt", '[)') && tsrange(b."scheduledAt", b."endsAt", '[)')
--    AND a.status IN ('PENDING','PENDING_GROUP_FILL','AWAITING_PAYMENT','CONFIRMED','CANCEL_REQUESTED','DEPOSIT_PAID','COMPLETED','NO_SHOW')
--    AND b.status IN ('PENDING','PENDING_GROUP_FILL','AWAITING_PAYMENT','CONFIRMED','CANCEL_REQUESTED','DEPOSIT_PAID','COMPLETED','NO_SHOW');
--
-- Each returned pair is a real double-booking from the bug; resolve it (cancel the
-- wrong one) before deploying.

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
    'DEPOSIT_PAID',
    'COMPLETED',
    'NO_SHOW'
  )
);
