-- EmailTemplate: collapse bilingual columns to single free-form fields.
-- Owners can now write the template in any language (or mix) — one subject, one body, one display name.

ALTER TABLE "EmailTemplate" ADD COLUMN "name" TEXT;
ALTER TABLE "EmailTemplate" ADD COLUMN "subject" TEXT;

-- Backfill: prefer Arabic, fall back to English, then to slug.
UPDATE "EmailTemplate"
SET
  "name"    = COALESCE("nameAr", "nameEn", "slug"),
  "subject" = COALESCE("subjectAr", "subjectEn", '');

ALTER TABLE "EmailTemplate" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "EmailTemplate" ALTER COLUMN "subject" SET NOT NULL;

ALTER TABLE "EmailTemplate" DROP COLUMN "nameAr";
ALTER TABLE "EmailTemplate" DROP COLUMN "nameEn";
ALTER TABLE "EmailTemplate" DROP COLUMN "subjectAr";
ALTER TABLE "EmailTemplate" DROP COLUMN "subjectEn";
