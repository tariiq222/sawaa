-- CreateEnum
CREATE TYPE "ZoomMeetingStatus" AS ENUM ('PENDING', 'CREATED', 'FAILED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "zoomMeetingCreatedAt" TIMESTAMP(3),
ADD COLUMN     "zoomMeetingError" TEXT,
ADD COLUMN     "zoomMeetingStatus" "ZoomMeetingStatus",
ADD COLUMN     "zoomStartUrl" TEXT;

-- Backfill existing rows
UPDATE "Booking" SET "zoomMeetingStatus" = 'CREATED' WHERE "zoomMeetingId" IS NOT NULL;
