-- Remove the dynamic BrandingConfig system.
--
-- Brand colors, font, logo, and favicon are now hardcoded in the apps. The only
-- branding values that stay editable are the organization name (Arabic/English)
-- and the product tagline — those move onto OrganizationSettings, where the org
-- name (companyNameAr/companyNameEn) already lived.
--
-- 1. Add productTagline to OrganizationSettings.
-- 2. Backfill name + tagline from the existing BrandingConfig row (if any) so the
--    live identity is preserved.
-- 3. Drop the BrandingConfig table and the now-unused WebsiteTheme enum.

ALTER TABLE "OrganizationSettings" ADD COLUMN "productTagline" TEXT;

-- Backfill from the most recent BrandingConfig row into the OrganizationSettings
-- row. Single-tenant: at most one row each. Only fill fields that are currently
-- empty so we never clobber an existing OrganizationSettings value.
UPDATE "OrganizationSettings" os
SET
  "companyNameAr"  = COALESCE(NULLIF(os."companyNameAr", ''), bc."organizationNameAr"),
  "companyNameEn"  = COALESCE(NULLIF(os."companyNameEn", ''), bc."organizationNameEn"),
  "productTagline" = bc."productTagline"
FROM (
  SELECT "organizationNameAr", "organizationNameEn", "productTagline"
  FROM "BrandingConfig"
  ORDER BY "createdAt" DESC
  LIMIT 1
) bc
WHERE TRUE;

DROP TABLE "BrandingConfig";

DROP TYPE "WebsiteTheme";
