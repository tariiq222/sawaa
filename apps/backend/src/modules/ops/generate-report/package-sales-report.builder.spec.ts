import { buildPackageSalesReport } from './package-sales-report.builder';

function makePrisma() {
  return {
    packagePurchase: { count: jest.fn().mockResolvedValue(0) },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
}

describe('buildPackageSalesReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns a zero state when there are no purchases or payments', async () => {
    const result = await buildPackageSalesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(result.purchaseCount).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.byBucket).toEqual({ cash: 0, network: 0, electronic: 0 });
    expect(result.byMethod).toEqual([]);
  });

  it('counts package purchases by paidAt within the range', async () => {
    prisma.packagePurchase.count.mockResolvedValue(7);
    const result = await buildPackageSalesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(result.purchaseCount).toBe(7);
    // Purchases are counted by paidAt, filtered to ACTIVE/COMPLETED (a refunded
    // purchase is not a sale) — assert the where clause shape.
    const where = prisma.packagePurchase.count.mock.calls[0][0].where;
    expect(where.paidAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
  });

  it('only counts payments on package-purchase invoices (invoice.packagePurchaseId not null), COMPLETED only', async () => {
    prisma.payment.findMany.mockResolvedValue([]);
    await buildPackageSalesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    const where = prisma.payment.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where.invoice).toEqual({ is: { packagePurchaseId: { not: null } } });
    expect(where.createdAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
  });

  it('sums revenue and groups into cash / network / electronic buckets per the real PaymentMethod enum', async () => {
    prisma.payment.findMany.mockResolvedValue([
      { amount: 10_000, method: 'CASH' },
      { amount: 20_000, method: 'MADA' },
      { amount: 5_000, method: 'ONLINE_CARD' },
      { amount: 3_000, method: 'TABBY' },
      { amount: 2_000, method: 'BANK_TRANSFER' },
    ]);
    const result = await buildPackageSalesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(result.totalRevenue).toBe(40_000);
    expect(result.byBucket.cash).toBe(10_000);
    expect(result.byBucket.network).toBe(20_000);
    // electronic = ONLINE_CARD + TABBY + BANK_TRANSFER
    expect(result.byBucket.electronic).toBe(10_000);
  });

  it('reports a per-method breakdown with amount + count', async () => {
    prisma.payment.findMany.mockResolvedValue([
      { amount: 10_000, method: 'CASH' },
      { amount: 5_000, method: 'CASH' },
      { amount: 20_000, method: 'MADA' },
    ]);
    const result = await buildPackageSalesReport(prisma, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    const cash = result.byMethod.find((m) => m.method === 'CASH');
    const mada = result.byMethod.find((m) => m.method === 'MADA');
    expect(cash).toEqual({ method: 'CASH', amount: 15_000, count: 2 });
    expect(mada).toEqual({ method: 'MADA', amount: 20_000, count: 1 });
  });
});
