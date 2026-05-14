import { ReconcileUsageCountersHandler } from './reconcile-usage-counters.handler';

const buildPrisma = () => ({
  $allTenants: {
    organization: {
      findMany: jest.fn(),
    },
  },
  branch: { count: jest.fn() },
  employee: { count: jest.fn() },
  service: { count: jest.fn() },
  booking: { count: jest.fn() },
});

/**
 * Mock ClsService whose cls.run() calls the callback synchronously
 * (same tick) with the mocked CLS store. cls.set() is a no-op since
 * the tenant-scoping extension is not loaded in unit tests.
 */
const buildCls = () => ({
  run: jest.fn(async (cb: () => Promise<unknown>) => cb()),
  set: jest.fn(),
});

describe('ReconcileUsageCountersHandler', () => {
  it('returns zero repairs in single-tenant mode', async () => {
    const prisma = buildPrisma();
    const cls = buildCls();

    const handler = new ReconcileUsageCountersHandler(
      prisma as never,
      cls as never,
    );

    const result = await handler.execute();
    expect(result.orgsScanned).toBe(0);
    expect(result.rowsRepaired).toBe(0);
  });
});
