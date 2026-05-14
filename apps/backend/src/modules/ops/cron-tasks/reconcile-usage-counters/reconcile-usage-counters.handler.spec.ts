import { ReconcileUsageCountersHandler } from './reconcile-usage-counters.handler';

const buildPrisma = () => ({
  branch: { count: jest.fn() },
  employee: { count: jest.fn() },
  service: { count: jest.fn() },
  booking: { count: jest.fn() },
});

describe('ReconcileUsageCountersHandler', () => {
  it('returns zero repairs in single-tenant mode', async () => {
    const prisma = buildPrisma();

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
    );

    const result = await handler.execute();
    expect(result.orgsScanned).toBe(0);
    expect(result.rowsRepaired).toBe(0);
  });
});
