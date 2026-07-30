-- Reconcile WhatsappAgentConfig columns with prisma/schema/comms.prisma.
--
-- The original migration (20260730000000_whatsapp_agent_config) created
-- phoneNumberId + businessAccountId plaintext columns that the Prisma
-- schema does not declare, and it left activeDays nullable (with a default).
-- The schema requires activeDays to be NOT NULL with a default of
-- [0,1,2,3,4]. We:
--   1. Drop the orphaned columns (they were never used — Meta Cloud creds
--      live in the encrypted payload via the meta-cloud credential variant).
--   2. Backfill any rows whose activeDays is NULL.
--   3. Enforce NOT NULL going forward.
--
-- This is the only migration that touches these columns; future schema
-- changes add a new additive migration.

-- Drop orphaned columns
ALTER TABLE "WhatsappAgentConfig"
  DROP COLUMN IF EXISTS "phoneNumberId",
  DROP COLUMN IF EXISTS "businessAccountId";

-- Backfill then constrain activeDays
UPDATE "WhatsappAgentConfig"
SET "activeDays" = ARRAY[0,1,2,3,4]::INTEGER[]
WHERE "activeDays" IS NULL;

ALTER TABLE "WhatsappAgentConfig"
  ALTER COLUMN "activeDays" SET NOT NULL,
  ALTER COLUMN "activeDays" SET DEFAULT ARRAY[0,1,2,3,4]::INTEGER[];
