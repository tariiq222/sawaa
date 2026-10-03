-- Additive expansion only. Rollback uses the previous application version;
-- retain these columns and enum (no destructive down migration).
CREATE TYPE "ClientCancelCutoffMode" AS ENUM ('BEFORE_START', 'BEFORE_CHECK_IN');

ALTER TABLE "BookingSettings"
ADD COLUMN "clientCancellationPolicyEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "clientCancelCutoffMode" "ClientCancelCutoffMode",
ADD COLUMN "clientCancelBeforeHours" INTEGER,
ADD COLUMN "earlyCancelRefundPercent" INTEGER;
