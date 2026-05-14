-- WARNING: This migration RENAMES slugs that don't satisfy the new CHECK constraint.
-- Old slugs become unreachable as subdomains immediately. Affected orgs are logged
-- via RAISE NOTICE during apply. Coordinate with operators before running on prod.

-- 1) Tighten column type (no-op if Prisma already added it)
ALTER TABLE "Organization" ALTER COLUMN "slug" TYPE VARCHAR(30) USING substr("slug", 1, 30);

-- 2) Backfill: rewrite any slug that violates the new pattern.
DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  i INT;
BEGIN
  FOR r IN
    SELECT id, slug
    FROM "Organization"
    WHERE slug !~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$'
  LOOP
    base := lower(r.slug);
    base := regexp_replace(base, '[_\s]+', '-', 'g');
    base := regexp_replace(base, '[^a-z0-9-]', '', 'g');
    base := regexp_replace(base, '-{2,}', '-', 'g');
    base := regexp_replace(base, '^-+|-+$', '', 'g');
    IF length(base) < 3 THEN
      base := substr(base || 'org', 1, 3);
    END IF;
    IF length(base) > 30 THEN
      base := regexp_replace(substr(base, 1, 30), '-+$', '', 'g');
    END IF;

    candidate := base;
    i := 2;
    WHILE EXISTS (SELECT 1 FROM "Organization" WHERE slug = candidate AND id <> r.id) LOOP
      candidate := substr(base, 1, 30 - length('-' || i::text)) || '-' || i::text;
      i := i + 1;
      IF i > 50 THEN
        RAISE EXCEPTION 'Slug normalization exhausted suffixes for org %', r.id;
      END IF;
    END LOOP;

    RAISE NOTICE 'Renaming slug for org %: % -> %', r.id, r.slug, candidate;
    UPDATE "Organization" SET slug = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- 3) Add the CHECK constraint (idempotent — drop if exists, then add).
ALTER TABLE "Organization"
  DROP CONSTRAINT IF EXISTS "Organization_slug_subdomain_chk";
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_slug_subdomain_chk"
  CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$');
