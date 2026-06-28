-- CreateTable
-- Distributed lease lock for single-leader cron execution (pool-safe replacement
-- for pg session advisory locks). See prisma/schema/ops.prisma CronLock.
CREATE TABLE "CronLock" (
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "lockedUntil" TIMESTAMP(3) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronLock_pkey" PRIMARY KEY ("name")
);
