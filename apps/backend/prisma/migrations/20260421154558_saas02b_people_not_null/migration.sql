-- SaaS-02b: flip organizationId to NOT NULL on 7 people-cluster tables.
-- Safety guard first — refuses to run if backfill missed rows.

DO $$
DECLARE
  bad integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "Client"                        WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Employee"                      WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeBranch"                WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeService"               WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeAvailability"          WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "EmployeeAvailabilityException" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "ClientRefreshToken"            WHERE "organizationId" IS NULL)
  INTO bad;
  IF bad > 0 THEN
    RAISE EXCEPTION 'SaaS-02b: % people rows still have NULL organizationId. Re-run backfill.', bad;
  END IF;
END $$;

ALTER TABLE "Client"                        ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Employee"                      ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeBranch"                ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeService"               ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeAvailability"          ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeAvailabilityException" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ClientRefreshToken"            ALTER COLUMN "organizationId" SET NOT NULL;
