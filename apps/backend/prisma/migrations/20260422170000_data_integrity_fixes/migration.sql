-- Data integrity fixes: CHECK constraints, OTP rate limiting, ID unification, availability endTime
-- 2026-04-22
-- Idempotent: uses IF NOT EXISTS / IF EXISTS to handle partial application

-- 1. CHECK: depositAmount must not exceed price (Service table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Service_depositAmount_check'
  ) THEN
    ALTER TABLE "Service" ADD CONSTRAINT "Service_depositAmount_check"
      CHECK ("depositAmount" IS NULL OR "depositAmount" <= "price");
  END IF;
END $$;

-- 2. CHECK: minParticipants <= maxParticipants (Service table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Service_participants_check'
  ) THEN
    ALTER TABLE "Service" ADD CONSTRAINT "Service_participants_check"
      CHECK ("minParticipants" <= "maxParticipants");
  END IF;
END $$;

-- 3. OTP rate limiting: add maxAttempts and lockout fields to OtpCode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'OtpCode' AND column_name = 'maxAttempts'
  ) THEN
    ALTER TABLE "OtpCode" ADD COLUMN "maxAttempts" INT NOT NULL DEFAULT 5;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'OtpCode' AND column_name = 'lockedUntil'
  ) THEN
    ALTER TABLE "OtpCode" ADD COLUMN "lockedUntil" TIMESTAMP(3);
  END IF;
END $$;

-- 4. OTP index for lockedUntil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'OtpCode_lockedUntil_idx'
  ) THEN
    CREATE INDEX "OtpCode_lockedUntil_idx" ON "OtpCode"("lockedUntil");
  END IF;
END $$;

-- 5. FeatureFlag: migrate from cuid() to uuid() (only if needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "FeatureFlag" 
    WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LIMIT 1
  ) THEN
    UPDATE "FeatureFlag" SET "id" = gen_random_uuid()::text 
    WHERE "id" !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'FeatureFlag' AND column_name = 'id' 
    AND udt_name != 'uuid'
  ) THEN
    ALTER TABLE "FeatureFlag" ALTER COLUMN "id" TYPE uuid USING "id"::uuid;
    ALTER TABLE "FeatureFlag" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    DROP SEQUENCE IF EXISTS "FeatureFlag_id_seq";
    ALTER TABLE "FeatureFlag" ALTER COLUMN "id" DROP DEFAULT;
  END IF;
END $$;

-- 6. EmployeeAvailabilityException: add endTime for partial-day leave support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'EmployeeAvailabilityException' AND column_name = 'endTime'
  ) THEN
    ALTER TABLE "EmployeeAvailabilityException" ADD COLUMN "endTime" TIME(3);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'EmployeeAvailabilityException' AND column_name = 'isStartTimeOnly'
  ) THEN
    ALTER TABLE "EmployeeAvailabilityException" ADD COLUMN "isStartTimeOnly" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 7. Add partial index for soft-delete queries (Client.deletedAt) — idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'Client_deletedAt_idx'
  ) THEN
    CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt") WHERE "deletedAt" IS NOT NULL;
  END IF;
END $$;

-- 8. Add CHECK for Booking.endsAt >= Booking.scheduledAt (sanity check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Booking_endsAt_check'
  ) THEN
    ALTER TABLE "Booking" ADD CONSTRAINT "Booking_endsAt_check"
      CHECK ("endsAt" >= "scheduledAt");
  END IF;
END $$;

-- 9. CouponRedemption: add unique constraint for per-user per-coupon enforcement
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CouponRedemption_couponId_clientId_key'
  ) THEN
    ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_clientId_key"
      UNIQUE ("couponId", "clientId");
  END IF;
END $$;
