-- Rename existing columns
ALTER TABLE "BrandingConfig" RENAME COLUMN "clinicNameAr" TO "organizationNameAr";
ALTER TABLE "BrandingConfig" RENAME COLUMN "clinicNameEn" TO "organizationNameEn";
ALTER TABLE "BrandingConfig" RENAME COLUMN "primaryColor" TO "colorPrimary";
ALTER TABLE "BrandingConfig" RENAME COLUMN "accentColor" TO "colorAccent";

-- Add new columns the form needs
ALTER TABLE "BrandingConfig" ADD COLUMN "productTagline" TEXT;
ALTER TABLE "BrandingConfig" ADD COLUMN "colorPrimaryLight" TEXT;
ALTER TABLE "BrandingConfig" ADD COLUMN "colorPrimaryDark" TEXT;
ALTER TABLE "BrandingConfig" ADD COLUMN "colorAccentDark" TEXT;
ALTER TABLE "BrandingConfig" ADD COLUMN "colorBackground" TEXT;
ALTER TABLE "BrandingConfig" ADD COLUMN "fontUrl" TEXT;
