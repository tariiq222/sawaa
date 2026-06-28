import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Lease duration. Long enough to cover the slowest cron run so the lease does
 * not expire mid-execution, short enough that a crashed leader's lock is
 * reclaimed promptly by another instance.
 */
const LEASE_MS = 10 * 60 * 1_000;

/**
 * Run `fn` on at most one instance at a time, guarded by a distributed lease
 * lock in the `CronLock` table.
 *
 * Why not pg session advisory locks (the previous implementation): Prisma runs
 * each `$queryRaw` on a connection borrowed from the pool, and a session
 * advisory lock is bound to the connection that took it. The acquire and the
 * release could land on different pooled connections, so `pg_advisory_unlock`
 * silently failed (returns false, never throws) and the lock leaked — after
 * which every later tick saw "lock not acquired" and the cron was skipped
 * forever. A lease row is connection-independent: each acquire/release is one
 * atomic statement, and a stale lease auto-expires.
 *
 * Acquire is a single upsert that only steals an expired lease, so two
 * instances racing can never both win. Release clears the lease only if we
 * still own it (a run that overran LEASE_MS may have been taken over) and is
 * best-effort — it never throws out of the `finally`.
 */
export async function withCronLeader(
  prisma: PrismaService,
  cronName: string,
  fn: () => Promise<void>,
): Promise<void> {
  const owner = randomUUID();
  const lockedUntil = new Date(Date.now() + LEASE_MS);

  const acquired = await prisma.$queryRaw<Array<{ name: string }>>`
    INSERT INTO "CronLock" ("name", "owner", "lockedUntil", "acquiredAt")
    VALUES (${cronName}, ${owner}, ${lockedUntil}, now())
    ON CONFLICT ("name") DO UPDATE
      SET "owner" = EXCLUDED."owner",
          "lockedUntil" = EXCLUDED."lockedUntil",
          "acquiredAt" = now()
      WHERE "CronLock"."lockedUntil" < now()
    RETURNING "name"
  `;

  if (acquired.length === 0) {
    Logger.log(`Cron ${cronName}: lease held by another instance, skipping`, 'CronLeader');
    return;
  }

  try {
    await fn();
  } finally {
    try {
      await prisma.$executeRaw`
        UPDATE "CronLock"
        SET "lockedUntil" = now() - interval '1 second'
        WHERE "name" = ${cronName} AND "owner" = ${owner}
      `;
    } catch (err) {
      Logger.warn(
        `Cron ${cronName}: failed to release lease: ${err instanceof Error ? err.message : String(err)}`,
        'CronLeader',
      );
    }
  }
}
