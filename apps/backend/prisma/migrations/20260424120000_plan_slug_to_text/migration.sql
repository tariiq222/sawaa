-- Convert Plan.slug from PlanSlug enum to TEXT so super-admins can create
-- arbitrary plans (STARTER, TEAM_ANNUAL, etc.) without a migration.
-- A CHECK constraint enforces the same uppercase/digits/underscore format
-- the admin DTO validates on the way in.

-- 1. Drop FKs that reference "Plan.slug" (none today) — kept as a no-op for clarity.
-- 2. Cast the enum column to TEXT in place.
ALTER TABLE "Plan"
  ALTER COLUMN "slug" TYPE TEXT USING "slug"::text;

-- 3. Enforce slug format at the DB layer.
ALTER TABLE "Plan"
  ADD CONSTRAINT "Plan_slug_format_chk"
  CHECK ("slug" ~ '^[A-Z][A-Z0-9_]{1,31}$');

-- 4. Drop the now-unused enum type.
DROP TYPE "PlanSlug";
