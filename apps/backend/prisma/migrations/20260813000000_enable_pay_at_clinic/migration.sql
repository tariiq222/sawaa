-- Enable pay-at-center for the existing single-tenant deployment and make it
-- the default for future OrganizationSettings rows. Administrators retain the
-- existing dashboard toggle and may disable the method later.
ALTER TABLE "OrganizationSettings"
  ALTER COLUMN "paymentAtClinicEnabled" SET DEFAULT true;

UPDATE "OrganizationSettings"
SET "paymentAtClinicEnabled" = true
WHERE "paymentAtClinicEnabled" = false;
