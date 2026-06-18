-- Drop the recurring series index on Booking
DROP INDEX IF EXISTS "Booking_recurringGroupId_idx";

-- Drop the recurring columns from Booking
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "recurringGroupId";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "recurringPattern";

-- Drop the recurring columns from Service
ALTER TABLE "Service" DROP COLUMN IF EXISTS "allowRecurring";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "allowedRecurringPatterns";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "maxRecurrences";

-- Drop the Prisma enums (no remaining references after source delete)
DROP TYPE IF EXISTS "RecurringFrequency";
DROP TYPE IF EXISTS "RecurringPattern";
