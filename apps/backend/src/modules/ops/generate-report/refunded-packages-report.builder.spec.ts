import { buildRefundedPackagesReport } from './refunded-packages-report.builder';

function makePrisma() {
  return {
    packagePurchase: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildRefundedPackagesReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns a zero state when nothing was refunded in the range', async () => {
    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(result.refundedCount).toBe(0);
    expect(result.totalRefunded).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('queries only REFUNDED purchases with refundedAt in range', async () => {
    await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    const args = prisma.packagePurchase.findMany.mock.calls[0][0];
    expect(args.where.status).toBe('REFUNDED');
    expect(args.where.refundedAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
  });

  it('lists each refunded purchase and sums refundAmount', async () => {
    prisma.packagePurchase.findMany.mockResolvedValue([
      {
        id: 'p1', packageId: 'pkg1', clientId: 'c1',
        amountPaid: 50_000, refundAmount: 50_000,
        refundedAt: new Date('2026-01-10'), notes: 'full refund',
      },
      {
        id: 'p2', packageId: 'pkg2', clientId: 'c2',
        amountPaid: 30_000, refundAmount: 10_000,
        refundedAt: new Date('2026-01-15'), notes: null,
      },
    ]);

    const result = await buildRefundedPackagesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });

    expect(result.refundedCount).toBe(2);
    expect(result.totalRefunded).toBe(60_000); // 50000 + 10000
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toEqual({
      purchaseId: 'p1',
      packageId: 'pkg1',
      clientId: 'c1',
      amountPaid: 50_000,
      refundAmount: 50_000,
      refundedAt: new Date('2026-01-10').toISOString(),
      notes: 'full refund',
    });
    expect(result.items[1].notes).toBeNull();
  });
});
