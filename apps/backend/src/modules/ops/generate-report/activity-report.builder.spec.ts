import { buildActivityReport } from './activity-report.builder';

const from = new Date('2026-01-01');
const to = new Date('2026-01-31');

const buildPrisma = () => ({
  activityLog: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'log-1', action: 'CREATE', entity: 'Booking', occurredAt: new Date('2026-01-05'), userId: 'u-1', userEmail: 'u@test.com' },
      { id: 'log-2', action: 'UPDATE', entity: 'Client', occurredAt: new Date('2026-01-10'), userId: 'u-2', userEmail: 'v@test.com' },
    ]),
  },
});

describe('buildActivityReport', () => {
  it('returns period with from and to', async () => {
    const prisma = buildPrisma();
    const result = await buildActivityReport(prisma as never, { from, to });
    expect(result.period.from).toBe(from.toISOString());
    expect(result.period.to).toBe(to.toISOString());
  });

  it('filters by date range using occurredAt', async () => {
    const prisma = buildPrisma();
    await buildActivityReport(prisma as never, { from, to });
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          occurredAt: expect.objectContaining({ gte: from, lte: to }),
        }),
      }),
    );
  });

  it('returns summary with totalActions', async () => {
    const prisma = buildPrisma();
    const result = await buildActivityReport(prisma as never, { from, to });
    expect(result.summary).toMatchObject({
      totalActions: expect.any(Number),
      uniqueUsers: expect.any(Number),
    });
  });

  it('returns byDay and byUser arrays', async () => {
    const prisma = buildPrisma();
    const result = await buildActivityReport(prisma as never, { from, to });
    expect(Array.isArray(result.byDay)).toBe(true);
    expect(Array.isArray(result.byUser)).toBe(true);
  });
});