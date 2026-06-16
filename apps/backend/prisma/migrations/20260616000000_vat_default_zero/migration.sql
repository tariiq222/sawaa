-- AlterTable: set vatRate default to 0 (center is not VAT-registered)
ALTER TABLE "OrganizationSettings" ALTER COLUMN "vatRate" SET DEFAULT 0;
ALTER TABLE "Invoice" ALTER COLUMN "vatRate" SET DEFAULT 0;
