-- CreateEnum
CREATE TYPE "CategoryBookingMode" AS ENUM ('DIRECT', 'SERVICES');

-- AlterTable
ALTER TABLE "ServiceCategory" ADD COLUMN "bookingMode" "CategoryBookingMode" NOT NULL DEFAULT 'SERVICES';
