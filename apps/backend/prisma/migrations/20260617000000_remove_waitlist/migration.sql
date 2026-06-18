-- Drop waitlist columns from BookingSettings
ALTER TABLE "BookingSettings" DROP COLUMN IF EXISTS "waitlistEnabled";
ALTER TABLE "BookingSettings" DROP COLUMN IF EXISTS "waitlistMaxPerSlot";

-- Drop waitlist columns from GroupSession
ALTER TABLE "GroupSession" DROP COLUMN IF EXISTS "waitlistEnabled";
ALTER TABLE "GroupSession" DROP COLUMN IF EXISTS "waitlistCount";

-- Drop GroupSessionWaitlist table (FK references GroupSession, must drop before WaitlistEntry)
DROP TABLE IF EXISTS "GroupSessionWaitlist";

-- Drop WaitlistEntry table
DROP TABLE IF EXISTS "WaitlistEntry";

-- Drop WaitlistStatus enum
DROP TYPE IF EXISTS "WaitlistStatus";
