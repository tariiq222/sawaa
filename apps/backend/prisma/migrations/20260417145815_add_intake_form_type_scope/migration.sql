-- CreateEnum
CREATE TYPE "IntakeFormType" AS ENUM ('PRE_BOOKING', 'PRE_SESSION', 'POST_SESSION', 'REGISTRATION');

-- CreateEnum
CREATE TYPE "IntakeFormScope" AS ENUM ('GLOBAL', 'SERVICE', 'EMPLOYEE', 'BRANCH');

-- AlterTable
ALTER TABLE "IntakeForm" ADD COLUMN     "scope" "IntakeFormScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "scopeId" TEXT,
ADD COLUMN     "type" "IntakeFormType" NOT NULL DEFAULT 'PRE_SESSION';
