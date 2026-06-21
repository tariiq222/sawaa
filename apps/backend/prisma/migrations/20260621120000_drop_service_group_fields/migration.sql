-- Drop the CHECK constraint first, then the now-dead group fields from Service.
-- The capacity-based group-session flow on Service was replaced by the standalone
-- GroupProgram model; these columns are no longer read by any handler.
ALTER TABLE "Service" DROP CONSTRAINT IF EXISTS "service_min_le_max_participants";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "minParticipants";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "maxParticipants";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "reserveWithoutPayment";
