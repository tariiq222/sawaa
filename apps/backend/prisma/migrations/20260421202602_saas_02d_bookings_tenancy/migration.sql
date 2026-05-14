-- Add organizationId to Booking
ALTER TABLE "Booking" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "Booking_organizationId_idx" ON "Booking"("organizationId");

-- Add organizationId to WaitlistEntry
ALTER TABLE "WaitlistEntry" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "WaitlistEntry_organizationId_idx" ON "WaitlistEntry"("organizationId");

-- Add organizationId to GroupSession
ALTER TABLE "GroupSession" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "GroupSession_organizationId_idx" ON "GroupSession"("organizationId");

-- Add organizationId to GroupEnrollment (denormalized from GroupSession)
ALTER TABLE "GroupEnrollment" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "GroupEnrollment_organizationId_idx" ON "GroupEnrollment"("organizationId");

-- Add organizationId to GroupSessionWaitlist (denormalized from GroupSession)
ALTER TABLE "GroupSessionWaitlist" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "GroupSessionWaitlist_organizationId_idx" ON "GroupSessionWaitlist"("organizationId");

-- Add organizationId to BookingStatusLog (denormalized from Booking)
ALTER TABLE "BookingStatusLog" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX "BookingStatusLog_organizationId_idx" ON "BookingStatusLog"("organizationId");

-- BookingSettings: add organizationId, drop old branchId unique, add composite unique
ALTER TABLE "BookingSettings" ADD COLUMN "organizationId" TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001';
DROP INDEX IF EXISTS "BookingSettings_branchId_key";
CREATE UNIQUE INDEX "BookingSettings_organizationId_branchId_key"
  ON "BookingSettings"("organizationId", "branchId");
CREATE INDEX "BookingSettings_organizationId_idx" ON "BookingSettings"("organizationId");

-- Remove DEFAULT after backfill (Prisma expects NOT NULL without default in schema)
ALTER TABLE "Booking" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "GroupSession" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "GroupEnrollment" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "GroupSessionWaitlist" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "BookingStatusLog" ALTER COLUMN "organizationId" DROP DEFAULT;
ALTER TABLE "BookingSettings" ALTER COLUMN "organizationId" DROP DEFAULT;
