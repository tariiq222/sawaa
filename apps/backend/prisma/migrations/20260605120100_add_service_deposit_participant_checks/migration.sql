-- Add the CHECK constraints that organization.prisma has long *claimed* exist
-- ("enforced via CHECK constraint in migration SQL") but which were never
-- actually created in any prior migration. Until now these invariants were
-- enforced only in the create/update-service handlers, so any seed, import, or
-- future handler bypassing validateBusinessRules could persist an invalid row
-- (depositAmount > price, or minParticipants > maxParticipants).
--
-- DEPENDENCY: Service.depositAmount/price/minParticipants/maxParticipants all
-- exist since the baseline migration.
--
-- Idempotent: guarded by pg_constraint existence checks so re-running is safe.

DO $$
BEGIN
  -- depositAmount, when set, must not exceed price. NULL deposit = no deposit.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_deposit_not_exceeding_price'
  ) THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "service_deposit_not_exceeding_price"
      CHECK ("depositAmount" IS NULL OR "depositAmount" <= "price");
  END IF;

  -- A service must allow at least one participant, and the minimum cannot exceed
  -- the maximum.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_min_le_max_participants'
  ) THEN
    ALTER TABLE "Service"
      ADD CONSTRAINT "service_min_le_max_participants"
      CHECK ("minParticipants" >= 1 AND "minParticipants" <= "maxParticipants");
  END IF;
END $$;
