-- SaaS-02b: add nullable organizationId to 7 people-cluster models + FK + indexes.
-- Replaces global uniques on Client.phone / Employee.email / Employee.slug with
-- per-org composite uniques. Nullable during backfill; NOT NULL in saas02b_people_not_null.

-- ─────────────────────────────────────────────────────────────────────────────
-- Client
--   Drop global phone unique → replace with composite (organizationId, phone).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Client" DROP CONSTRAINT IF EXISTS "Client_phone_key";
DROP INDEX IF EXISTS "Client_phone_key";

ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "client_org_phone" ON "Client"("organizationId", "phone");
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

ALTER TABLE "Client"
  ADD CONSTRAINT "Client_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Employee
--   Drop global email + slug uniques → replace with composite per-org uniques.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_email_key";
DROP INDEX IF EXISTS "Employee_email_key";
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_slug_key";
DROP INDEX IF EXISTS "Employee_slug_key";

ALTER TABLE "Employee" ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "employee_org_email" ON "Employee"("organizationId", "email");
CREATE UNIQUE INDEX "employee_org_slug"  ON "Employee"("organizationId", "slug");
CREATE INDEX "Employee_organizationId_idx" ON "Employee"("organizationId");

ALTER TABLE "Employee"
  ADD CONSTRAINT "Employee_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- EmployeeBranch / EmployeeService / EmployeeAvailability / EmployeeAvailabilityException
--   Denormalized organizationId — mirrors parent Employee.
--   Prisma scoping extension cannot traverse joins, so we store org directly.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "EmployeeBranch"                ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeService"               ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeAvailability"          ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeAvailabilityException" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "EmployeeBranch_organizationId_idx"                ON "EmployeeBranch"("organizationId");
CREATE INDEX "EmployeeService_organizationId_idx"               ON "EmployeeService"("organizationId");
CREATE INDEX "EmployeeAvailability_organizationId_idx"          ON "EmployeeAvailability"("organizationId");
CREATE INDEX "EmployeeAvailabilityException_organizationId_idx" ON "EmployeeAvailabilityException"("organizationId");

ALTER TABLE "EmployeeBranch"
  ADD CONSTRAINT "EmployeeBranch_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeService"
  ADD CONSTRAINT "EmployeeService_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeAvailability"
  ADD CONSTRAINT "EmployeeAvailability_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeAvailabilityException"
  ADD CONSTRAINT "EmployeeAvailabilityException_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- ClientRefreshToken (identity BC — mirrors parent Client.organizationId)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "ClientRefreshToken" ADD COLUMN "organizationId" TEXT;

CREATE INDEX "ClientRefreshToken_organizationId_idx" ON "ClientRefreshToken"("organizationId");

ALTER TABLE "ClientRefreshToken"
  ADD CONSTRAINT "ClientRefreshToken_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
