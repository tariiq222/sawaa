-- SaaS-02c: promote organizationId from nullable to NOT NULL on 14 org-config/org-experience tables.
-- Safety guard: abort if any row is still NULL (should be zero after backfill in 20260421162500).
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COALESCE(
    (SELECT COUNT(*) FROM "Branch"                WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Department"            WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ServiceCategory"       WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Service"               WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ServiceBookingConfig"  WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ServiceDurationOption" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeServiceOption" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "BusinessHour"          WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Holiday"               WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "BrandingConfig"        WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "IntakeForm"            WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "IntakeField"           WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Rating"               WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "OrganizationSettings"  WHERE "organizationId" IS NULL),
    0
  ) INTO null_count;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'SaaS-02c NOT NULL guard: % rows still have NULL organizationId — run backfill first', null_count;
  END IF;
END $$;

-- Apply NOT NULL constraints
ALTER TABLE "Branch"                ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Department"            ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ServiceCategory"       ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Service"               ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ServiceBookingConfig"  ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ServiceDurationOption" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeServiceOption" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "BusinessHour"          ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Holiday"               ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "BrandingConfig"        ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "IntakeForm"            ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "IntakeField"           ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Rating"               ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OrganizationSettings"  ALTER COLUMN "organizationId" SET NOT NULL;
