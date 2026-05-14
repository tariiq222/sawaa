-- SaaS-02c: assign existing rows to default organization.
-- Child tables inherit from parent — more robust than hardcoded UUIDs if a
-- future staging DB has different orgs.

UPDATE "Branch"          SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Department"      SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ServiceCategory" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Service"         SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "IntakeForm"      SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Rating"          SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;

-- Inherit from parents
UPDATE "ServiceBookingConfig"  sbc SET "organizationId" = s."organizationId"   FROM "Service"              s   WHERE sbc."serviceId"       = s.id   AND sbc."organizationId"  IS NULL;
UPDATE "ServiceDurationOption" sdo SET "organizationId" = s."organizationId"   FROM "Service"              s   WHERE sdo."serviceId"       = s.id   AND sdo."organizationId"  IS NULL;
UPDATE "EmployeeServiceOption" eso SET "organizationId" = sdo."organizationId" FROM "ServiceDurationOption" sdo WHERE eso."durationOptionId" = sdo.id AND eso."organizationId" IS NULL;
UPDATE "BusinessHour"          bh  SET "organizationId" = b."organizationId"  FROM "Branch"               b   WHERE bh."branchId"          = b.id  AND bh."organizationId"   IS NULL;
UPDATE "Holiday"               h   SET "organizationId" = b."organizationId"  FROM "Branch"               b   WHERE h."branchId"           = b.id  AND h."organizationId"    IS NULL;
UPDATE "IntakeField"           f   SET "organizationId" = i."organizationId"  FROM "IntakeForm"            i   WHERE f."formId"             = i.id  AND f."organizationId"   IS NULL;

-- Singletons (IDEMPOTENT — existing 'default' row gets default org)
UPDATE "BrandingConfig"       SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OrganizationSettings" SET "organizationId" = '00000000-0000-0000-0000-000000000001' WHERE "organizationId" IS NULL;
