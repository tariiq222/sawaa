-- SaaS-02c: Add nullable organizationId to 12 non-singleton org-cluster models
-- + singleton schema changes for BrandingConfig and OrganizationSettings.

-- ─── Non-singleton models ───────────────────────────────────────────────────

ALTER TABLE "Branch"                ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Department"            ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ServiceCategory"       ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Service"               ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ServiceBookingConfig"  ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ServiceDurationOption" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "EmployeeServiceOption" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "BusinessHour"          ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Holiday"               ADD COLUMN "organizationId" TEXT;
ALTER TABLE "IntakeForm"            ADD COLUMN "organizationId" TEXT;
ALTER TABLE "IntakeField"           ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Rating"                ADD COLUMN "organizationId" TEXT;

-- ─── Singleton models ────────────────────────────────────────────────────────

ALTER TABLE "BrandingConfig"       ADD COLUMN "organizationId" TEXT;
ALTER TABLE "OrganizationSettings" ADD COLUMN "organizationId" TEXT;

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX "Branch_organizationId_idx"                ON "Branch"                ("organizationId");
CREATE INDEX "Department_organizationId_idx"            ON "Department"            ("organizationId");
CREATE INDEX "ServiceCategory_organizationId_idx"       ON "ServiceCategory"       ("organizationId");
CREATE INDEX "Service_organizationId_idx"               ON "Service"               ("organizationId");
CREATE INDEX "ServiceBookingConfig_organizationId_idx"  ON "ServiceBookingConfig"  ("organizationId");
CREATE INDEX "ServiceDurationOption_organizationId_idx" ON "ServiceDurationOption" ("organizationId");
CREATE INDEX "EmployeeServiceOption_organizationId_idx" ON "EmployeeServiceOption" ("organizationId");
CREATE INDEX "BusinessHour_organizationId_idx"          ON "BusinessHour"          ("organizationId");
CREATE INDEX "Holiday_organizationId_idx"               ON "Holiday"               ("organizationId");
CREATE INDEX "IntakeForm_organizationId_idx"            ON "IntakeForm"            ("organizationId");
CREATE INDEX "IntakeField_organizationId_idx"           ON "IntakeField"           ("organizationId");
CREATE INDEX "Rating_organizationId_idx"                ON "Rating"                ("organizationId");

-- ─── Composite unique on Department.nameAr (replaces global @unique) ─────────

DROP INDEX IF EXISTS "Department_nameAr_key";
CREATE UNIQUE INDEX "dept_org_nameAr" ON "Department" ("organizationId", "nameAr");

-- ─── Singleton unique indexes ─────────────────────────────────────────────────

CREATE UNIQUE INDEX "BrandingConfig_organizationId_key"       ON "BrandingConfig"       ("organizationId");
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings" ("organizationId");

-- ─── Singleton id default change ─────────────────────────────────────────────
-- existing row keeps id='default'; new rows will get gen_random_uuid()
ALTER TABLE "BrandingConfig"       ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "OrganizationSettings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- ─── Foreign keys ────────────────────────────────────────────────────────────

ALTER TABLE "Branch"                ADD CONSTRAINT "Branch_organizationId_fkey"                FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Department"            ADD CONSTRAINT "Department_organizationId_fkey"            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "ServiceCategory"       ADD CONSTRAINT "ServiceCategory_organizationId_fkey"       FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Service"               ADD CONSTRAINT "Service_organizationId_fkey"               FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "ServiceBookingConfig"  ADD CONSTRAINT "ServiceBookingConfig_organizationId_fkey"  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "ServiceDurationOption" ADD CONSTRAINT "ServiceDurationOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "EmployeeServiceOption" ADD CONSTRAINT "EmployeeServiceOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "BusinessHour"          ADD CONSTRAINT "BusinessHour_organizationId_fkey"          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Holiday"               ADD CONSTRAINT "Holiday_organizationId_fkey"               FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "IntakeForm"            ADD CONSTRAINT "IntakeForm_organizationId_fkey"            FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "IntakeField"           ADD CONSTRAINT "IntakeField_organizationId_fkey"           FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "Rating"                ADD CONSTRAINT "Rating_organizationId_fkey"                FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "BrandingConfig"        ADD CONSTRAINT "BrandingConfig_organizationId_fkey"        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
ALTER TABLE "OrganizationSettings"  ADD CONSTRAINT "OrganizationSettings_organizationId_fkey"  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT;
