/**
 * One-shot backfill script — recomputes all UsageCounter rows from live DB counts.
 *
 * Replaces every org's BRANCHES, EMPLOYEES, SERVICES (EPOCH period) and
 * MONTHLY_BOOKINGS (current month) counters with the true active-entity counts.
 *
 * Usage:  npm run backfill:counters
 *
 * Safe to run multiple times (upserts, idempotent).
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, BookingStatus } from '@prisma/client';

const EPOCH = new Date('1970-01-01T00:00:00.000Z');

function startOfMonthUTC(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function upsertCounter(
  prisma: PrismaClient,
  organizationId: string,
  featureKey: string,
  periodStart: Date,
  count: number,
): Promise<void> {
  await prisma.usageCounter.upsert({
    where: { organizationId_featureKey_periodStart: { organizationId, featureKey, periodStart } },
    update: { value: count },
    create: { organizationId, featureKey, periodStart, value: count },
  });
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const startOfMonth = startOfMonthUTC();

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  // eslint-disable-next-line no-console
  console.log(`[backfill] Processing ${orgs.length} organizations...`);

  for (const { id: orgId } of orgs) {
    const branches = await prisma.branch.count({ where: { organizationId: orgId, isActive: true } });
    const employees = await prisma.employee.count({ where: { organizationId: orgId, isActive: true } });
    const services = await prisma.service.count({ where: { organizationId: orgId, isActive: true } });
    const bookings = await prisma.booking.count({
      where: { organizationId: orgId, scheduledAt: { gte: startOfMonth }, status: { not: BookingStatus.CANCELLED } },
    });

    await upsertCounter(prisma, orgId, 'branches', EPOCH, branches);
    await upsertCounter(prisma, orgId, 'employees', EPOCH, employees);
    await upsertCounter(prisma, orgId, 'services', EPOCH, services);
    await upsertCounter(prisma, orgId, 'monthly_bookings', startOfMonth, bookings);

    // eslint-disable-next-line no-console
    console.log(`[backfill] ${orgId} → branches=${branches} employees=${employees} services=${services} bookings=${bookings}`);
  }

  await prisma.$disconnect();
  // eslint-disable-next-line no-console
  console.log('[backfill] Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
