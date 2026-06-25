import { PackageReportsHandler, PackageReportType } from './package-reports.handler';

describe('PackageReportsHandler', () => {
  function buildPrisma() {
    return {
      packagePurchase: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      packageCredit: {
        findMany: jest.fn().mockResolvedValue([]),
        fields: { totalQuantity: 'totalQuantity' },
      },
      packageCreditUsage: { findMany: jest.fn().mockResolvedValue([]) },
      employee: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
  }

  it('normalises a reversed date range (from > to swaps)', async () => {
    const prisma = buildPrisma();
    const handler = new PackageReportsHandler(prisma);
    await handler.execute({
      report: PackageReportType.SALES,
      from: '2026-03-31',
      to: '2026-01-01',
    });
    const where = prisma.packagePurchase.count.mock.calls[0][0].where;
    expect(where.paidAt.gte.getTime()).toBeLessThan(where.paidAt.lte.getTime());
  });

  it('routes SALES to the sales builder', async () => {
    const prisma = buildPrisma();
    prisma.packagePurchase.count.mockResolvedValue(3);
    const handler = new PackageReportsHandler(prisma);
    const result = await handler.execute({ report: PackageReportType.SALES, from: '2026-01-01', to: '2026-01-31' });
    expect(result).toHaveProperty('purchaseCount', 3);
    expect(result).toHaveProperty('byBucket');
  });

  it('routes OUTSTANDING_CREDIT to the liability builder', async () => {
    const prisma = buildPrisma();
    const handler = new PackageReportsHandler(prisma);
    const result = await handler.execute({ report: PackageReportType.OUTSTANDING_CREDIT, from: '2026-01-01', to: '2026-01-31' });
    expect(result).toHaveProperty('outstandingLiability');
    expect(result).toHaveProperty('outstandingSessions');
  });

  it('routes CONSUMPTION to the consumption builder', async () => {
    const prisma = buildPrisma();
    const handler = new PackageReportsHandler(prisma);
    const result = await handler.execute({ report: PackageReportType.CONSUMPTION, from: '2026-01-01', to: '2026-01-31' });
    expect(result).toHaveProperty('totalConsumed');
    expect(result).toHaveProperty('byEmployee');
  });

  it('routes REFUNDED to the refunded-packages builder', async () => {
    const prisma = buildPrisma();
    const handler = new PackageReportsHandler(prisma);
    const result = await handler.execute({ report: PackageReportType.REFUNDED, from: '2026-01-01', to: '2026-01-31' });
    expect(result).toHaveProperty('refundedCount');
    expect(result).toHaveProperty('totalRefunded');
  });

  it('throws on an unknown report type', async () => {
    const prisma = buildPrisma();
    const handler = new PackageReportsHandler(prisma);
    await expect(
      handler.execute({ report: 'BOGUS' as PackageReportType, from: '2026-01-01', to: '2026-01-31' }),
    ).rejects.toThrow();
  });
});
