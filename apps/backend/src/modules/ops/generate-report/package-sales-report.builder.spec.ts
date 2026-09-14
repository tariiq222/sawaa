import { buildPackageSalesReport } from './package-sales-report.builder';

type PaymentFixture = {
  amount: number;
  refundedAmount?: number;
  method: string;
  status?: string;
  createdAt?: Date;
  invoice?: { packagePurchaseId: string | null } | null;
};

type PurchaseFixture = {
  paidAt: Date;
  status: string;
};

function makePrisma(data: { payments?: PaymentFixture[]; purchases?: PurchaseFixture[] } = {}) {
  const payments = data.payments ?? [];
  const purchases = data.purchases ?? [];

  return {
    packagePurchase: {
      count: jest.fn().mockImplementation(({ where }) =>
        purchases.filter(
          (purchase) =>
            purchase.paidAt >= where.paidAt.gte &&
            purchase.paidAt <= where.paidAt.lte &&
            where.status.in.includes(purchase.status),
        ).length,
      ),
    },
    payment: {
      findMany: jest.fn().mockImplementation(({ where }) => {
        const statuses = Array.isArray(where.status?.in) ? where.status.in : [where.status];
        return payments
          .filter(
            (payment) =>
              payment.createdAt !== undefined &&
              payment.createdAt >= where.createdAt.gte &&
              payment.createdAt <= where.createdAt.lte &&
              statuses.includes(payment.status) &&
              payment.invoice?.packagePurchaseId !== null &&
              payment.invoice?.packagePurchaseId !== undefined,
          )
          .map(({ amount, refundedAmount, method }) => ({ amount, refundedAmount, method }));
      }),
    },
  } as any;
}

const RANGE = {
  from: new Date('2026-01-01'),
  to: new Date('2026-01-31'),
};

function packagePayment(overrides: Partial<PaymentFixture> = {}): PaymentFixture {
  return {
    amount: 1_000,
    method: 'CASH',
    status: 'COMPLETED',
    createdAt: new Date('2026-01-15'),
    invoice: { packagePurchaseId: 'purchase-1' },
    ...overrides,
  };
}

function packagePurchase(overrides: Partial<PurchaseFixture> = {}): PurchaseFixture {
  return {
    paidAt: new Date('2026-01-15'),
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('buildPackageSalesReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns a zero state when there are no purchases or payments', async () => {
    const result = await buildPackageSalesReport(prisma, RANGE);
    expect(result.purchaseCount).toBe(0);
    expect(result).toMatchObject({ grossRevenue: 0, refundedAmount: 0, netRevenue: 0, totalRevenue: 0 });
    expect(result.byBucket).toEqual({ cash: 0, network: 0, electronic: 0 });
    expect(result.byMethod).toEqual([]);
  });

  it('counts package purchases by paidAt within the range', async () => {
    prisma = makePrisma({
      purchases: [
        packagePurchase({ status: 'ACTIVE' }),
        packagePurchase({ status: 'COMPLETED' }),
        packagePurchase({ status: 'REFUNDED' }),
        packagePurchase({ status: 'PENDING' }),
        packagePurchase({ paidAt: new Date('2025-12-31') }),
        packagePurchase({ paidAt: new Date('2026-02-01') }),
      ],
    });
    const result = await buildPackageSalesReport(prisma, RANGE);
    expect(result.purchaseCount).toBe(3);
    // Purchases are counted by paidAt, filtered to ACTIVE/COMPLETED/REFUNDED.
    const where = prisma.packagePurchase.count.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['ACTIVE', 'COMPLETED', 'REFUNDED'] });
    expect(where.paidAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
  });

  it('selects settled payments on package-purchase invoices only', async () => {
    await buildPackageSalesReport(prisma, RANGE);
    const where = prisma.payment.findMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: ['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED'] });
    expect(where.invoice).toEqual({ is: { packagePurchaseId: { not: null } } });
    expect(where.createdAt).toEqual({ gte: new Date('2026-01-01'), lte: new Date('2026-01-31') });
  });

  it('sums revenue and groups into cash / network / electronic buckets per the real PaymentMethod enum', async () => {
    prisma = makePrisma({
      payments: [
        packagePayment({ amount: 10_000 }),
        packagePayment({ amount: 20_000, method: 'MADA' }),
        packagePayment({ amount: 5_000, method: 'ONLINE_CARD' }),
        packagePayment({ amount: 3_000, method: 'TABBY' }),
        packagePayment({ amount: 2_000, method: 'BANK_TRANSFER' }),
      ],
    });
    const result = await buildPackageSalesReport(prisma, RANGE);
    expect(result.totalRevenue).toBe(40_000);
    expect(result.byBucket.cash).toBe(10_000);
    expect(result.byBucket.network).toBe(20_000);
    // electronic = ONLINE_CARD + TABBY + BANK_TRANSFER
    expect(result.byBucket.electronic).toBe(10_000);
    expect(result.grossRevenue).toBe(40_000);
    expect(result.refundedAmount).toBe(0);
    expect(result.netRevenue).toBe(40_000);
  });

  it('keeps partially refunded payments in the sales cohort and reports gross, refunds, and net', async () => {
    prisma = makePrisma({
      payments: [packagePayment({ amount: 100_000, refundedAmount: 10_000, status: 'PARTIALLY_REFUNDED' })],
    });

    const result = await buildPackageSalesReport(prisma, RANGE);

    expect(result).toMatchObject({
      grossRevenue: 100_000,
      refundedAmount: 10_000,
      netRevenue: 90_000,
      totalRevenue: 90_000,
    });
  });

  it('reports a per-method breakdown with amount + count', async () => {
    prisma = makePrisma({
      payments: [
        packagePayment({ amount: 10_000 }),
        packagePayment({ amount: 5_000 }),
        packagePayment({ amount: 20_000, method: 'MADA' }),
      ],
    });
    const result = await buildPackageSalesReport(prisma, RANGE);
    const cash = result.byMethod.find((m) => m.method === 'CASH');
    const mada = result.byMethod.find((m) => m.method === 'MADA');
    expect(cash).toEqual({ method: 'CASH', amount: 15_000, count: 2 });
    expect(mada).toEqual({ method: 'MADA', amount: 20_000, count: 1 });
  });

  it('preserves gross and payment count when a payment is fully refunded', async () => {
    prisma = makePrisma({
      payments: [packagePayment({ amount: 100_000, refundedAmount: 100_000, status: 'REFUNDED' })],
    });

    const result = await buildPackageSalesReport(prisma, RANGE);

    expect(result).toMatchObject({ grossRevenue: 100_000, refundedAmount: 100_000, netRevenue: 0, totalRevenue: 0 });
    expect(result.byMethod).toEqual([{ method: 'CASH', amount: 0, count: 1 }]);
  });

  it('nets mixed payment methods into their operational buckets', async () => {
    prisma = makePrisma({
      payments: [
        packagePayment({ amount: 10_000, refundedAmount: 1_000 }),
        packagePayment({ amount: 20_000, refundedAmount: 20_000, method: 'MADA', status: 'REFUNDED' }),
        packagePayment({ amount: 5_000, method: 'ONLINE_CARD' }),
      ],
    });

    const result = await buildPackageSalesReport(prisma, RANGE);

    expect(result).toMatchObject({ grossRevenue: 35_000, refundedAmount: 21_000, netRevenue: 14_000 });
    expect(result.byBucket).toEqual({ cash: 9_000, network: 0, electronic: 5_000 });
    expect(result.byMethod).toEqual([
      { method: 'CASH', amount: 9_000, count: 1 },
      { method: 'MADA', amount: 0, count: 1 },
      { method: 'ONLINE_CARD', amount: 5_000, count: 1 },
    ]);
  });

  it('excludes pending and failed payments and non-package invoices', async () => {
    prisma = makePrisma({
      payments: [
        packagePayment({ amount: 10_000 }),
        packagePayment({ amount: 20_000, status: 'PENDING' }),
        packagePayment({ amount: 30_000, status: 'FAILED' }),
        packagePayment({ amount: 40_000, invoice: { packagePurchaseId: null } }),
      ],
    });

    const result = await buildPackageSalesReport(prisma, RANGE);

    expect(result).toMatchObject({ grossRevenue: 10_000, refundedAmount: 0, netRevenue: 10_000, totalRevenue: 10_000 });
    expect(result.byMethod).toEqual([{ method: 'CASH', amount: 10_000, count: 1 }]);
  });

  it('includes payments exactly on the date boundaries and excludes rows outside them', async () => {
    prisma = makePrisma({
      payments: [
        packagePayment({ amount: 10_001, createdAt: RANGE.from }),
        packagePayment({ amount: 20_002, createdAt: RANGE.to }),
        packagePayment({ amount: 30_003, createdAt: new Date('2025-12-31T23:59:59.999Z') }),
        packagePayment({ amount: 40_004, createdAt: new Date('2026-02-01T00:00:00.000Z') }),
      ],
    });

    const result = await buildPackageSalesReport(prisma, RANGE);

    expect(result).toMatchObject({ grossRevenue: 30_003, refundedAmount: 0, netRevenue: 30_003 });
  });

  it('rejects a refund amount that would make a payment net negative', async () => {
    prisma = makePrisma({ payments: [packagePayment({ amount: 10_000, refundedAmount: 10_001 })] });

    await expect(buildPackageSalesReport(prisma, RANGE)).rejects.toThrow(
      'refundedAmount must be between 0 and amount',
    );
  });
});
