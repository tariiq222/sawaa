import { PaymentStatus } from '@prisma/client';
import { buildRevenueReport } from './revenue-report.builder';

function makePrisma() {
  return {
    booking: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: { findMany: jest.fn().mockResolvedValue([]) },
    refundRequest: { findMany: jest.fn().mockResolvedValue([]) },
    couponRedemption: { findMany: jest.fn().mockResolvedValue([]) },
    coupon: { findMany: jest.fn().mockResolvedValue([]) },
    client: { findMany: jest.fn().mockResolvedValue([]) },
    service: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  } as any;
}

const completed = (
  amount: number,
  method: string,
  createdAt: Date,
) => ({
  id: 'p',
  amount,
  method,
  status: PaymentStatus.COMPLETED,
  createdAt,
  invoice: null,
});

function mockAggregates(
  prisma: any,
  options: {
    statuses?: Array<{ status: string; amount: number; count: number }>;
    methods?: Array<{ method: string; amount: number; count: number }>;
    days?: Array<{ date: string; amount: number; count: number }>;
    refunds?: number;
    totalBookings?: number;
    avgDurationMins?: number;
    coupons?: Array<{ couponId: string; uses: number; discount: number }>;
  } = {},
) {
  prisma.$queryRaw
    .mockResolvedValueOnce(options.statuses ?? [])
    .mockResolvedValueOnce(options.methods ?? [])
    .mockResolvedValueOnce(options.days ?? [])
    .mockResolvedValueOnce([{ amount: options.refunds ?? 0 }])
    .mockResolvedValueOnce([{
      total: options.totalBookings ?? 0,
      avgDurationMins: options.avgDurationMins ?? 0,
    }])
    .mockResolvedValueOnce(options.coupons ?? []);
}

describe('buildRevenueReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('does not read payment, refund, or coupon aggregate rows through full-row Prisma reads', async () => {
    await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-02-01'),
    });

    expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 10,
    }));
    expect(prisma.refundRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.couponRedemption.findMany).not.toHaveBeenCalled();
  });

  it.each([
    { status: PaymentStatus.PARTIALLY_REFUNDED, refund: 1_000, net: 9_000 },
    { status: PaymentStatus.REFUNDED, refund: 10_000, net: 0 },
  ])('retains original settlement when a payment becomes $status', async ({ status, refund, net }) => {
    mockAggregates(prisma, {
      statuses: [{ status, amount: 10_000, count: 1 }],
      methods: [{ method: 'CASH', amount: 10_000, count: 1 }],
      days: [{ date: '2025-01-15', amount: 10_000, count: 1 }],
      refunds: refund,
    });
    const report = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'), toExclusive: new Date('2025-01-31'),
    });
    expect(report.totalRevenue).toBe(10_000);
    expect(report.refundsTotal).toBe(refund);
    expect(report.netRevenue).toBe(net);
    expect(report.byMethod).toEqual([{ method: 'CASH', amount: 10_000, count: 1 }]);
    expect(report.byDay).toEqual([{ date: '2025-01-15', amount: 10_000, count: 1 }]);
  });

  it('keeps a refund-only reporting period negative without manufacturing current-period receipts', async () => {
    mockAggregates(prisma, { refunds: 1_000 });
    const report = await buildRevenueReport(prisma, {
      from: new Date('2025-02-01'), toExclusive: new Date('2025-02-28'),
    });
    expect(report).toMatchObject({ totalRevenue: 0, refundsTotal: 1_000, netRevenue: -1_000 });
    expect(report.byMethod).toEqual([]);
  });

  it('keeps pending and failed payments out of settled method/day totals', async () => {
    mockAggregates(prisma, {
      statuses: [
        { status: PaymentStatus.PENDING, amount: 10_000, count: 1 },
        { status: PaymentStatus.FAILED, amount: 20_000, count: 1 },
      ],
    });
    const report = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'), toExclusive: new Date('2025-01-31'),
    });
    expect(report.totalRevenue).toBe(0);
    expect(report.byMethod).toEqual([]);
    expect(report.byDay).toEqual([]);
    expect(report.byStatus).toHaveLength(2);
  });

  it('maps PostgreSQL textual numerics and bigint counts without leaking database types', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ status: PaymentStatus.COMPLETED, amount: '10000.00', count: 1n }])
      .mockResolvedValueOnce([{ method: 'CASH', amount: '10000.00', count: 1n }])
      .mockResolvedValueOnce([{ date: '2025-01-15', amount: '10000.00', count: 1n }])
      .mockResolvedValueOnce([{ amount: '2500.00' }])
      .mockResolvedValueOnce([{ total: 3n, avgDurationMins: '60' }])
      .mockResolvedValueOnce([]);

    const report = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-02-01'),
    });

    expect(report).toMatchObject({
      totalRevenue: 10000,
      refundsTotal: 2500,
      netRevenue: 7500,
      totalBookings: 3,
      averagePerBooking: 3333,
    });
    expect(report.byStatus).toEqual([{ status: PaymentStatus.COMPLETED, amount: 10000, count: 1 }]);
  });

  it('restricts completed refunds through the same invoice branch and employee snapshot', async () => {
    const from = new Date('2025-01-01');
    const toExclusive = new Date('2025-02-01');
    await buildRevenueReport(prisma, { from, toExclusive, branchId: 'branch-a', employeeId: 'employee-a' });
    expect(prisma.$queryRaw).toHaveBeenCalled();
    const refundSql = prisma.$queryRaw.mock.calls
      .map(([sql]: any[]) => sql as { strings?: readonly string[] })
      .find((sql: { strings?: readonly string[] }) => sql.strings?.join('').includes('FROM "RefundRequest"'));
    expect(refundSql?.strings?.join('')).toContain('i."branchId"');
    expect(refundSql?.strings?.join('')).toContain('i."employeeId"');
  });

  it('groups late-evening UTC settlement into its actual Riyadh calendar day', async () => {
    mockAggregates(prisma, {
      methods: [{ method: 'CASH', amount: 100, count: 1 }],
      days: [{ date: '2025-01-16', amount: 100, count: 1 }],
    });
    const report = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'), toExclusive: new Date('2025-01-31'),
    });
    expect(report.byDay).toEqual([{ date: '2025-01-16', amount: 100, count: 1 }]);
  });

  it('returns zeros when no data', async () => {
    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(0);
    expect(result.netRevenue).toBe(0);
    expect(result.totalBookings).toBe(0);
    expect(result.averagePerBooking).toBe(0);
    expect(result.refundsTotal).toBe(0);
    expect(result.byMethod).toEqual([]);
    expect(result.byStatus).toEqual([]);
    expect(result.byDay).toEqual([]);
    expect(result.couponsUsed).toEqual([]);
    expect(result.recentPayments).toEqual([]);
  });

  it('computes summary stats correctly', async () => {
    mockAggregates(prisma, {
      methods: [
        { method: 'CASH', amount: 100, count: 1 },
        { method: 'ONLINE_CARD', amount: 50, count: 1 },
      ],
      totalBookings: 3,
    });

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(150);
    expect(result.totalBookings).toBe(3);
    expect(result.averagePerBooking).toBe(50);
  });

  it('subtracts refunds for netRevenue', async () => {
    mockAggregates(prisma, {
      methods: [{ method: 'CASH', amount: 300, count: 1 }],
      refunds: 50,
    });

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(300);
    expect(result.refundsTotal).toBe(50);
    expect(result.netRevenue).toBe(250);
  });

  it('groups by payment method (completed only)', async () => {
    mockAggregates(prisma, {
      methods: [
        { method: 'CASH', amount: 300, count: 2 },
        { method: 'ONLINE_CARD', amount: 50, count: 1 },
      ],
    });

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-01-31'),
    });
    expect(result.byMethod).toHaveLength(2);
    const cash = result.byMethod.find((m) => m.method === 'CASH');
    expect(cash?.amount).toBe(300);
    expect(cash?.count).toBe(2);
  });

  it('groups by day sorted chronologically', async () => {
    mockAggregates(prisma, {
      days: [
        { date: '2025-01-14', amount: 50, count: 1 },
        { date: '2025-01-15', amount: 300, count: 2 },
      ],
    });

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      toExclusive: new Date('2025-01-31'),
    });
    expect(result.byDay).toHaveLength(2);
    expect(result.byDay[0]).toEqual({ date: '2025-01-14', amount: 50, count: 1 });
    expect(result.byDay[1]).toEqual({ date: '2025-01-15', amount: 300, count: 2 });
  });
});

it('uses historical collection date for recent rows and selects the page in that order', async () => {
 const prisma = makePrisma();
 prisma.payment.findMany.mockResolvedValue([{...completed(15000, 'CASH', new Date('2026-10-05')), effectiveReceivedAt: new Date('2026-09-01')}]);
 const report = await buildRevenueReport(prisma, {from: new Date('2026-09-01'), toExclusive: new Date('2026-10-01')});
 expect(report.recentPayments[0].date).toBe('2026-09-01T00:00:00.000Z');
 expect(prisma.$queryRaw.mock.calls[6][0].sql).toContain('ORDER BY COALESCE(p."effectiveReceivedAt", p."createdAt") DESC, p."id" DESC');
});
