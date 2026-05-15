import { PaymentStatus } from '@prisma/client';
import { buildRevenueReport } from './revenue-report.builder';

describe('buildRevenueReport', () => {
  let prisma: any;

  beforeEach(() => {
    prisma = {
      booking: { count: jest.fn().mockResolvedValue(0) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
    };
  });

  it('should return empty report when no data', async () => {
    const result = await buildRevenueReport(prisma, { from: new Date('2025-01-01'), to: new Date('2025-01-31') });
    expect(result.totalRevenue).toBe(0);
    expect(result.totalBookings).toBe(0);
    expect(result.averagePerBooking).toBe(0);
    expect(result.byMethod).toEqual([]);
    expect(result.byDay).toEqual([]);
  });

  it('should compute summary stats correctly', async () => {
    prisma.booking.count.mockResolvedValue(3);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 100, method: 'CASH', createdAt: new Date('2025-01-15') },
      { amount: 50, method: 'MOYASAR', createdAt: new Date('2025-01-16') },
    ]);

    const result = await buildRevenueReport(prisma, { from: new Date('2025-01-01'), to: new Date('2025-01-31') });
    expect(result.totalRevenue).toBe(150);
    expect(result.totalBookings).toBe(3);
    expect(result.averagePerBooking).toBe(50);
  });

  it('should group by payment method', async () => {
    prisma.booking.count.mockResolvedValue(2);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 100, method: 'CASH', createdAt: new Date('2025-01-15') },
      { amount: 200, method: 'CASH', createdAt: new Date('2025-01-16') },
      { amount: 50, method: 'MOYASAR', createdAt: new Date('2025-01-15') },
    ]);

    const result = await buildRevenueReport(prisma, { from: new Date('2025-01-01'), to: new Date('2025-01-31') });
    expect(result.byMethod).toHaveLength(2);
    const cash = result.byMethod.find((m) => m.method === 'CASH');
    expect(cash?.amount).toBe(300);
    expect(cash?.count).toBe(2);
  });

  it('should group by day sorted chronologically', async () => {
    prisma.booking.count.mockResolvedValue(0);
    prisma.payment.findMany.mockResolvedValue([
      { amount: 100, method: 'CASH', createdAt: new Date('2025-01-15T10:00:00Z') },
      { amount: 50, method: 'CASH', createdAt: new Date('2025-01-14T10:00:00Z') },
      { amount: 200, method: 'CASH', createdAt: new Date('2025-01-15T14:00:00Z') },
    ]);

    const result = await buildRevenueReport(prisma, { from: new Date('2025-01-01'), to: new Date('2025-01-31') });
    expect(result.byDay).toHaveLength(2);
    expect(result.byDay[0].date).toBe('2025-01-14');
    expect(result.byDay[0].amount).toBe(50);
    expect(result.byDay[1].date).toBe('2025-01-15');
    expect(result.byDay[1].amount).toBe(300);
  });
});
