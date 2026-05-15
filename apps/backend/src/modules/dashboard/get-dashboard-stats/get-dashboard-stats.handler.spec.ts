import { Test } from '@nestjs/testing';
import { GetDashboardStatsHandler } from './get-dashboard-stats.handler';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('../../../common/helpers/date-tz.helper', () => ({
  todayRangeInTz: jest.fn().mockReturnValue({ start: new Date('2026-01-01'), end: new Date('2026-01-02') }),
}));

describe('GetDashboardStatsHandler', () => {
  let handler: GetDashboardStatsHandler;
  let prisma: {
    employee: { findFirst: jest.Mock };
    booking: { count: jest.Mock };
    payment: { count: jest.Mock; aggregate: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      booking: { count: jest.fn().mockResolvedValue(0) },
      payment: { count: jest.fn().mockResolvedValue(0), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
    };

    const module = await Test.createTestingModule({
      providers: [
        GetDashboardStatsHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(GetDashboardStatsHandler);
  });

  it('returns zero stats for employee without linked row', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    const result = await handler.execute({ userId: 'u1', role: 'EMPLOYEE' });
    expect(result).toEqual({ todayBookings: 0, confirmedToday: 0, pendingToday: 0, cancelRequests: 0 });
  });

  it('returns booking stats for employee with linked row', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const result = await handler.execute({ userId: 'u1', role: 'EMPLOYEE' });
    expect(result.todayBookings).toBe(5);
    expect(result.confirmedToday).toBe(3);
    expect(result.pendingToday).toBe(1);
    expect(result.cancelRequests).toBe(2);
    expect(prisma.booking.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: 'emp-1' }) }),
    );
  });

  it('returns stats with payment data for OWNER', async () => {
    prisma.booking.count.mockResolvedValue(0);
    prisma.payment.count.mockResolvedValue(3);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: { toString: () => '1500.50' } } });
    const result = await handler.execute({ userId: 'u1', role: 'OWNER' });
    expect(result.pendingPayments).toBe(3);
    expect(result.todayRevenue).toBe(1500.5);
  });

  it('returns stats with payment data for ADMIN', async () => {
    prisma.booking.count.mockResolvedValue(0);
    prisma.payment.count.mockResolvedValue(1);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const result = await handler.execute({ userId: 'u1', role: 'ADMIN' });
    expect(result.pendingPayments).toBe(1);
    expect(result.todayRevenue).toBe(0);
  });

  it('returns stats without payment data for non-payment roles', async () => {
    prisma.booking.count.mockResolvedValue(0);
    const result = await handler.execute({ userId: 'u1', role: 'EMPLOYEE' });
    expect(result.pendingPayments).toBeUndefined();
    expect(result.todayRevenue).toBeUndefined();
  });

  it('uses empty role fallback for payment check', async () => {
    prisma.booking.count.mockResolvedValue(0);
    const result = await handler.execute({ userId: 'u1' });
    expect(result.pendingPayments).toBeUndefined();
  });
});
