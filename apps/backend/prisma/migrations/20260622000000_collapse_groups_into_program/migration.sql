-- Collapse the two-model group system (GroupSession + GroupProgram) into a
-- single Program model served at route /programs.
--
-- Steps (ordered to satisfy foreign keys):
--   1. Drop the staff-overlap exclusion constraint (depends on groupSessionId)
--   2. Drop the Booking ↔ GroupSession FK and column
--   3. Drop the GroupEnrollment table (Cascade-dropped; depended on GroupSession)
--   4. Drop the GroupSession table
--   5. Drop the GroupProgram table
--   6. Drop the GroupSessionStatus enum
--   7. Create the new ProgramStatus enum
--   8. Create the new Program, ProgramEnrollment, and ProgramSupervisor tables
--   9. Wire up Booking.programId ↔ ProgramEnrollment.bookingId (1:1)
--  10. Add the deposit-amount CHECK constraint
--  11. Recreate the staff-overlap exclusion on programId (replaces groupSessionId)

-- 1. Drop the staff-overlap constraint that references groupSessionId
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_staff_active_time_no_overlap";

-- 2. Drop Booking.groupSessionId + its FK
ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "Booking_groupSessionId_fkey";
DROP INDEX IF EXISTS "Booking_groupSessionId_idx";
ALTER TABLE "Booking" DROP COLUMN IF EXISTS "groupSessionId";

-- 3. Drop GroupEnrollment
DROP TABLE IF EXISTS "GroupEnrollment";

-- 4. Drop GroupSession
DROP TABLE IF EXISTS "GroupSession";

-- 5. Drop GroupProgram
DROP TABLE IF EXISTS "GroupProgram";

-- 6. Drop the obsolete GroupSessionStatus enum
DROP TYPE IF EXISTS "GroupSessionStatus";

-- 7. Create the new ProgramStatus enum
CREATE TYPE "ProgramStatus" AS ENUM (
  'DRAFT',
  'OPEN',
  'MIN_REACHED',
  'SCHEDULED',
  'COMPLETED',
  'CANCELLED'
);

-- 8a. Program table
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "ref" SERIAL NOT NULL,
    "departmentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionAr" TEXT,
    "descriptionEn" TEXT,
    "startDate" TIMESTAMP(3),
    "daysCount" INTEGER NOT NULL,
    "hoursPerDay" INTEGER NOT NULL,
    "minParticipants" INTEGER NOT NULL DEFAULT 1,
    "maxParticipants" INTEGER NOT NULL DEFAULT 30,
    "enrolledCount" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "depositEnabled" BOOLEAN NOT NULL DEFAULT false,
    "depositAmount" DECIMAL(12,2),
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "publicDescriptionAr" TEXT,
    "publicDescriptionEn" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Program_ref_key" ON "Program"("ref");
CREATE INDEX "Program_departmentId_idx" ON "Program"("departmentId");
CREATE INDEX "Program_branchId_idx" ON "Program"("branchId");
CREATE INDEX "Program_status_idx" ON "Program"("status");
CREATE INDEX "Program_isPublic_idx" ON "Program"("isPublic");
CREATE INDEX "Program_status_startDate_idx" ON "Program"("status", "startDate");

-- 8b. ProgramSupervisor (composite PK)
CREATE TABLE "ProgramSupervisor" (
    "programId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramSupervisor_pkey" PRIMARY KEY ("programId","employeeId")
);

CREATE INDEX "ProgramSupervisor_employeeId_idx" ON "ProgramSupervisor"("employeeId");

-- 8c. ProgramEnrollment
CREATE TABLE "ProgramEnrollment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramEnrollment_bookingId_key" ON "ProgramEnrollment"("bookingId");
CREATE UNIQUE INDEX "ProgramEnrollment_programId_clientId_key" ON "ProgramEnrollment"("programId","clientId");
CREATE INDEX "ProgramEnrollment_clientId_idx" ON "ProgramEnrollment"("clientId");
CREATE INDEX "ProgramEnrollment_programId_idx" ON "ProgramEnrollment"("programId");

-- 9. Wire up Booking.programId → ProgramEnrollment.bookingId (1:1)
-- The Booking.programId column already exists from migration 20260621101541;
-- the FK to ProgramEnrollment.bookingId gives us the inverse relation.
ALTER TABLE "ProgramEnrollment"
  ADD CONSTRAINT "ProgramEnrollment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramEnrollment"
  ADD CONSTRAINT "ProgramEnrollment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProgramSupervisor"
  ADD CONSTRAINT "ProgramSupervisor_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10. Enforce: depositAmount <= price when deposit is enabled.
ALTER TABLE "Program"
  ADD CONSTRAINT "program_deposit_lte_price_chk"
  CHECK ("depositAmount" IS NULL OR "depositAmount" <= "price");

-- 11. Recreate the staff-overlap exclusion on programId. The semantics are
-- identical: bookings in the same Program (COALESCE) can overlap (multiple
-- participants in the same group session), but bookings for the same employee
-- outside a Program cannot overlap.
ALTER TABLE "Booking"
ADD CONSTRAINT "booking_staff_active_time_no_overlap"
EXCLUDE USING gist (
  "employeeId" WITH =,
  tsrange("scheduledAt", "endsAt", '[)') WITH &&,
  (COALESCE("programId", id)) WITH <>
)
WHERE (
  status IN (
    'PENDING',
    'PENDING_GROUP_FILL',
    'AWAITING_PAYMENT',
    'CONFIRMED',
    'CANCEL_REQUESTED',
    'DEPOSIT_PAID'
  )
);
