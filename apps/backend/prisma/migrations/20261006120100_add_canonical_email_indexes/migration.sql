-- Run scripts/check-email-entry-duplicates.ts before staging deployment.
-- No data is rewritten. A collision aborts index creation. Hot-table size and
-- lock duration must be reviewed before deployment (migration charter §3).
-- Deliberately transactional: both identity constraints must land together.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE UNIQUE INDEX "user_email_canonical_unique_idx" ON "User" (lower(email));
CREATE UNIQUE INDEX "client_email_canonical_unique_idx" ON "Client" (lower(email))
  WHERE email IS NOT NULL AND email <> '' AND "deletedAt" IS NULL;
COMMIT;
