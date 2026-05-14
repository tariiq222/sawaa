import { PrismaService } from '../../infrastructure/database/prisma.service';

export async function withCronLeader(
  prisma: PrismaService,
  cronName: string,
  fn: () => Promise<void>,
): Promise<void> {
  const lockKey = await prisma.$queryRaw<[{ v: bigint }]>`
    SELECT hashtext(${cronName})::bigint AS v
  `;
  const lockId = lockKey[0].v;

  const acquired = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_lock(${lockId}) AS acquired
  `;

  if (!acquired[0].acquired) {
    console.log(`Cron ${cronName}: lock not acquired, skipping`);
    return;
  }

  try {
    await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockId})`;
  }
}
