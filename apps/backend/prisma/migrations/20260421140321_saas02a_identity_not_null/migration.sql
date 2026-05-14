-- SaaS-02a: make organizationId NOT NULL on identity models.
-- Runs after the backfill migration (saas02a_identity_backfill). The DO block
-- is a belt-and-suspenders check in case someone inserted NULL rows between
-- the backfill and this migration — rare in practice but cheap to verify.

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM "RefreshToken" WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "CustomRole"   WHERE "organizationId" IS NULL) +
    (SELECT COUNT(*) FROM "Permission"   WHERE "organizationId" IS NULL)
  INTO bad_count;
  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'SaaS-02a: % identity rows still have NULL organizationId. Re-run backfill before NOT NULL.',
      bad_count;
  END IF;
END $$;

ALTER TABLE "RefreshToken" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CustomRole"   ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Permission"   ALTER COLUMN "organizationId" SET NOT NULL;
