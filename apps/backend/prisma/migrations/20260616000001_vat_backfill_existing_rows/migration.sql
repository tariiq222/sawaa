-- Backfill existing OrganizationSettings row to vatRate = 0 (center is not VAT-registered)
UPDATE "OrganizationSettings" SET "vatRate" = 0;
