-- Enforce the uniqueness invariants that 20260522030000_security_hardening_constraints
-- only attempted "best effort": that migration wrapped each CREATE UNIQUE INDEX in
-- `EXCEPTION WHEN unique_violation THEN RAISE WARNING ... skipped`, so on a dataset
-- with duplicates the index was silently NOT created and the migration still
-- succeeded — leaving the OTP/reset-hijack and cross-booking-lookup invariants
-- unprotected with no signal.
--
-- This migration verifies the three indexes actually exist. If any is missing
-- (i.e. was skipped earlier because of duplicates), it FAILS the migration with a
-- clear message. This is the intended behavior: a deploy must not proceed while a
-- uniqueness guarantee the application relies on is absent.
--
-- OPERATIONAL PRECONDITION (run BEFORE deploying this migration):
--   SELECT phone, COUNT(*) FROM "Client"
--     WHERE phone IS NOT NULL AND phone <> '' GROUP BY phone HAVING COUNT(*) > 1;
--   SELECT email, COUNT(*) FROM "Client"
--     WHERE email IS NOT NULL AND email <> '' GROUP BY email HAVING COUNT(*) > 1;
--   SELECT "bookingNumber", COUNT(*) FROM "Booking"
--     WHERE "bookingNumber" IS NOT NULL GROUP BY "bookingNumber" HAVING COUNT(*) > 1;
-- Clean up any rows these return, then deploy. If indexes are present, this
-- migration is a no-op.

DO $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  -- Try to (re)create each index. If it already exists, the IF NOT EXISTS guard
  -- skips it. If it does NOT exist and duplicates are present, the CREATE raises
  -- unique_violation and we record it as missing instead of swallowing it.

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'client_phone_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX client_phone_unique_idx
        ON "Client" ("phone")
        WHERE "phone" IS NOT NULL AND "phone" <> '';
    EXCEPTION WHEN unique_violation THEN
      missing := array_append(missing, 'client_phone_unique_idx (duplicate phones present)');
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'client_email_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX client_email_unique_idx
        ON "Client" ("email")
        WHERE "email" IS NOT NULL AND "email" <> '';
    EXCEPTION WHEN unique_violation THEN
      missing := array_append(missing, 'client_email_unique_idx (duplicate emails present)');
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'booking_bookingnumber_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX booking_bookingnumber_unique_idx
        ON "Booking" ("bookingNumber")
        WHERE "bookingNumber" IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      missing := array_append(missing, 'booking_bookingnumber_unique_idx (duplicate bookingNumbers present)');
    END;
  END IF;

  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Required unique indexes could not be created due to existing duplicates: %. Clean up the duplicate rows (see the SELECT queries in this migration''s header) and re-run.', array_to_string(missing, ', ');
  END IF;
END $$;
