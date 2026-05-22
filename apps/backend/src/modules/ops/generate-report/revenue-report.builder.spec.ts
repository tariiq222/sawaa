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

describe('buildRevenueReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = makePrisma();
  });

  it('returns zeros when no data', async () => {
    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
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
    prisma.booking.count.mockResolvedValue(3);
    prisma.payment.findMany
      .mockResolvedValueOnce([
        completed(100, 'CASH', new Date('2025-01-15')),
        completed(50, 'ONLINE_CARD', new Date('2025-01-16')),
      ])
      .mockResolvedValueOnce([]);

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(150);
    expect(result.totalBookings).toBe(3);
    expect(result.averagePerBooking).toBe(50);
  });

  it('subtracts refunds for netRevenue', async () => {
    prisma.payment.findMany
      .mockResolvedValueOnce([completed(300, 'CASH', new Date('2025-01-15'))])
      .mockResolvedValueOnce([]);
    prisma.refundRequest.findMany.mockResolvedValue([{ amount: 50 }]);

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.totalRevenue).toBe(300);
    expect(result.refundsTotal).toBe(50);
    expect(result.netRevenue).toBe(250);
  });

  it('groups by payment method (completed only)', async () => {
    prisma.payment.findMany
      .mockResolvedValueOnce([
        completed(100, 'CASH', new Date('2025-01-15')),
        completed(200, 'CASH', new Date('2025-01-16')),
        completed(50, 'ONLINE_CARD', new Date('2025-01-15')),
      ])
      .mockResolvedValueOnce([]);

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.byMethod).toHaveLength(2);
    const cash = result.byMethod.find((m) => m.method === 'CASH');
    expect(cash?.amount).toBe(300);
    expect(cash?.count).toBe(2);
  });

  it('groups by day sorted chronologically', async () => {
    prisma.payment.findMany
      .mockResolvedValueOnce([
        completed(100, 'CASH', new Date('2025-01-15T10:00:00Z')),
        completed(50, 'CASH', new Date('2025-01-14T10:00:00Z')),
        completed(200, 'CASH', new Date('2025-01-15T14:00:00Z')),
      ])
      .mockResolvedValueOnce([]);

    const result = await buildRevenueReport(prisma, {
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    });
    expect(result.byDay).toHaveLength(2);
    expect(result.byDay[0]).toEqual({ date: '2025-01-14', amount: 50, count: 1 });
    expect(result.byDay[1]).toEqual({ date: '2025-01-15', amount: 300, count: 2 });
  });
});
