-- Migration: TASK-DB-03 Class A — intra-bookings FKs
-- GroupEnrollment.bookingId → Booking (CASCADE: enrollment is owned by the booking)
-- Booking.groupSessionId → GroupSession (SET NULL: booking survives if group session is deleted)
--
-- Zero orphans confirmed before adding these constraints (audit run 2026-05-02).

-- 1. GroupEnrollment.bookingId → Booking (ON DELETE CASCADE)
ALTER TABLE "GroupEnrollment"
  ADD CONSTRAINT "GroupEnrollment_bookingId_fkey"
  FOREIGN KEY ("bookingId")
  REFERENCES "Booking"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- 2. Booking.groupSessionId → GroupSession (ON DELETE SET NULL)
ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_groupSessionId_fkey"
  FOREIGN KEY ("groupSessionId")
  REFERENCES "GroupSession"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
