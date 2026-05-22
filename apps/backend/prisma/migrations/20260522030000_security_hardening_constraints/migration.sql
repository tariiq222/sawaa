-- Security hardening (P1): add uniqueness + integrity constraints that the
-- audit identified as missing. Each constraint is created with conditional
-- logic so the migration is idempotent and survives an existing dataset that
-- might already contain incidental duplicates (we warn rather than fail).

-- ──────────────────────────────────────────────────────────────────────────
-- 1) Client.phone & Client.email — partial unique indexes
--    Client carries password+tokenVersion; duplicates enable OTP/reset hijack.
--    Use partial unique indexes so multiple NULLs are still allowed (history
--    has walk-in clients with no contact info).
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Phone: only enforce uniqueness on non-null, non-empty values.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'client_phone_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX client_phone_unique_idx
        ON "Client" ("phone")
        WHERE "phone" IS NOT NULL AND "phone" <> '';
    EXCEPTION WHEN unique_violation THEN
      RAISE WARNING 'client_phone_unique_idx skipped: existing duplicates present — clean up before re-running';
    END;
  END IF;

  -- Email: same pattern.
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'client_email_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX client_email_unique_idx
        ON "Client" ("email")
        WHERE "email" IS NOT NULL AND "email" <> '';
    EXCEPTION WHEN unique_violation THEN
      RAISE WARNING 'client_email_unique_idx skipped: existing duplicates present — clean up before re-running';
    END;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- 2) Booking.bookingNumber — unique (only when present)
--    The bookingNumber is a public-facing identifier; duplicates would let
--    one client see another's booking via the lookup endpoint.
-- ──────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'booking_bookingnumber_unique_idx'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX booking_bookingnumber_unique_idx
        ON "Booking" ("bookingNumber")
        WHERE "bookingNumber" IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE WARNING 'booking_bookingnumber_unique_idx skipped: existing duplicates present — clean up before re-running';
    END;
  END IF;
END $$;
