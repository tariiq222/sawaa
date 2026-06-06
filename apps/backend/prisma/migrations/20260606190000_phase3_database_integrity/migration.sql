-- Phase 3 database integrity hardening.
--
-- This migration is intentionally SQL-only: Prisma schema cannot represent
-- PostgreSQL partial or expression unique indexes. It does not delete or modify
-- application data; it fails before adding constraints if existing data violates
-- the required invariants.

-- -----------------------------------------------------------------------------
-- 1) Client contact uniqueness must ignore soft-deleted rows.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Client"
    WHERE "deletedAt" IS NULL
      AND "email" IS NOT NULL
      AND "email" <> ''
    GROUP BY "email"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active-only client_email_unique_idx: active clients contain duplicate non-empty emails.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "Client"
    WHERE "deletedAt" IS NULL
      AND "phone" IS NOT NULL
      AND "phone" <> ''
    GROUP BY "phone"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create active-only client_phone_unique_idx: active clients contain duplicate non-empty phones.';
  END IF;
END $$;

-- Replace the older all-row partial indexes with active-row partial indexes.
-- The active uniqueness behavior is unchanged, while soft-deleted clients no
-- longer block re-using the same email or phone on a new active client.
DROP INDEX IF EXISTS client_email_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS client_email_unique_idx
  ON "Client" ("email")
  WHERE "deletedAt" IS NULL AND "email" IS NOT NULL AND "email" <> '';

DROP INDEX IF EXISTS client_phone_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS client_phone_unique_idx
  ON "Client" ("phone")
  WHERE "deletedAt" IS NULL AND "phone" IS NOT NULL AND "phone" <> '';

-- -----------------------------------------------------------------------------
-- 2) BookingSettings uniqueness: one global row and one row per branch.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "BookingSettings" WHERE "branchId" IS NULL) > 1 THEN
    RAISE EXCEPTION 'Cannot create BookingSettings global singleton index: more than one row has branchId IS NULL.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "BookingSettings"
    WHERE "branchId" IS NOT NULL
    GROUP BY "branchId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create BookingSettings per-branch unique index: duplicate non-null branchId values exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "BookingSettings_global_singleton_idx"
  ON "BookingSettings" ((true))
  WHERE "branchId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BookingSettings_branchId_unique_idx"
  ON "BookingSettings" ("branchId")
  WHERE "branchId" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) Single-tenant singleton config tables.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "OrganizationPaymentConfig") > 1 THEN
    RAISE EXCEPTION 'Cannot create OrganizationPaymentConfig singleton index: more than one row exists.';
  END IF;

  IF (SELECT COUNT(*) FROM "OrganizationSmsConfig") > 1 THEN
    RAISE EXCEPTION 'Cannot create OrganizationSmsConfig singleton index: more than one row exists.';
  END IF;

  IF (SELECT COUNT(*) FROM "OrganizationEmailConfig") > 1 THEN
    RAISE EXCEPTION 'Cannot create OrganizationEmailConfig singleton index: more than one row exists.';
  END IF;

  IF (SELECT COUNT(*) FROM "BrandingConfig") > 1 THEN
    RAISE EXCEPTION 'Cannot create BrandingConfig singleton index: more than one row exists.';
  END IF;

  IF (SELECT COUNT(*) FROM "OrganizationSettings") > 1 THEN
    RAISE EXCEPTION 'Cannot create OrganizationSettings singleton index: more than one row exists.';
  END IF;

  IF (SELECT COUNT(*) FROM "ChatbotConfig") > 1 THEN
    RAISE EXCEPTION 'Cannot create ChatbotConfig singleton index: more than one row exists.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationPaymentConfig_singleton_idx"
  ON "OrganizationPaymentConfig" ((true));

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationSmsConfig_singleton_idx"
  ON "OrganizationSmsConfig" ((true));

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationEmailConfig_singleton_idx"
  ON "OrganizationEmailConfig" ((true));

CREATE UNIQUE INDEX IF NOT EXISTS "BrandingConfig_singleton_idx"
  ON "BrandingConfig" ((true));

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationSettings_singleton_idx"
  ON "OrganizationSettings" ((true));

CREATE UNIQUE INDEX IF NOT EXISTS "ChatbotConfig_singleton_idx"
  ON "ChatbotConfig" ((true));

-- -----------------------------------------------------------------------------
-- 4) Additional required uniqueness and lookup indexes.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "EmailTemplate"
    GROUP BY "slug"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create EmailTemplate_slug_key: duplicate slugs exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "GroupSessionWaitlist"
    GROUP BY "groupSessionId", "position"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create GroupSessionWaitlist_groupSessionId_position_key: duplicate positions exist within a group session.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_slug_key"
  ON "EmailTemplate" ("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "GroupSessionWaitlist_groupSessionId_position_key"
  ON "GroupSessionWaitlist" ("groupSessionId", "position");

CREATE INDEX IF NOT EXISTS "Booking_groupSessionId_idx"
  ON "Booking" ("groupSessionId");
