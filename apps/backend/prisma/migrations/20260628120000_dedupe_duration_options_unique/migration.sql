-- Deduplicate ServiceDurationOption and guard against future duplicates.
--
-- Root cause: SetServiceBookingConfigsHandler / SetEmployeeDurationsHandler
-- created a fresh ServiceDurationOption row for every payload option without an
-- id, and there was no UNIQUE constraint on the (serviceId, deliveryType,
-- durationMins, employeeServiceId) menu key — so repeated service edits
-- accumulated duplicate active rows that surfaced in the package builder's
-- duration dropdown. Handler-level dedup now prevents new duplicates; this
-- migration clears the historical ones and adds a DB-level backstop.
--
-- 1. Soft-deactivate duplicate active rows, keeping exactly one per menu key.
--    Keep priority: the default row, then a row referenced by a Booking, then
--    the most recently updated, then the lowest id (deterministic tiebreak).
--    Soft (isActive=false) — never hard delete: Booking.durationOptionId is a
--    plain string ref, and EmployeeServiceOption FKs onto this table with
--    onDelete: Cascade, so a hard delete would drop practitioner overrides.
WITH ranked AS (
    SELECT
        o."id",
        ROW_NUMBER() OVER (
            PARTITION BY
                o."serviceId",
                o."deliveryType",
                o."durationMins",
                COALESCE(o."employeeServiceId", '')
            ORDER BY
                o."isDefault" DESC,
                (EXISTS (SELECT 1 FROM "Booking" b WHERE b."durationOptionId" = o."id")) DESC,
                o."updatedAt" DESC,
                o."id" ASC
        ) AS rn
    FROM "ServiceDurationOption" o
    WHERE o."isActive" = true
)
UPDATE "ServiceDurationOption" s
SET "isActive" = false,
    "updatedAt" = NOW()
FROM ranked
WHERE s."id" = ranked."id"
  AND ranked.rn > 1;

-- 2. Add a partial UNIQUE backstop on the active menu key. NULLS NOT DISTINCT
--    so two service-level rows (employeeServiceId IS NULL) collide as expected.
--    Guarded by a DO block (same pattern as the existing one-default index) so a
--    surprise residual duplicate cannot block the production migration.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "ServiceDurationOption"
        WHERE "isActive" = true
        GROUP BY "serviceId", "deliveryType", "durationMins", COALESCE("employeeServiceId", '')
        HAVING COUNT(*) > 1
    ) THEN
        CREATE UNIQUE INDEX "ServiceDurationOption_active_menu_key_idx"
            ON "ServiceDurationOption"("serviceId", "deliveryType", "durationMins", "employeeServiceId")
            NULLS NOT DISTINCT
            WHERE "isActive" = true;
    ELSE
        RAISE NOTICE 'Skipped ServiceDurationOption_active_menu_key_idx because duplicate active rows still exist.';
    END IF;
END $$;
