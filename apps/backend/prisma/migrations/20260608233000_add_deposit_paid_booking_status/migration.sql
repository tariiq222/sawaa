-- Add DEPOSIT_PAID to the BookingStatus enum.
--
-- DEPOSIT_PAID represents a booking where the client has paid the configured
-- service deposit: the appointment time is reserved but a remaining balance is
-- still due. This is the structural batch 1 of the deposit feature — the enum
-- value and its state-machine transitions are introduced here; payment wiring
-- that actually moves bookings into this state lands in a later batch.
--
-- Additive enum value — safe and non-destructive. Postgres requires ALTER TYPE
-- ADD VALUE to run outside a transaction block; Prisma runs each migration
-- statement-by-statement so this is fine on its own.

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PAID';
