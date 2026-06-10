import { Test } from '@nestjs/testing';
import { GetDashboardStatsHandler } from './get-dashboard-stats.handler';
import { PrismaService } from '../../../infrastructure/database';

jest.mock('../../../common/helpers/date-tz.helper', () => ({
  dateRangeInTz: jest.fn().mockReturnValue({ start: new Date('2026-01-01'), end: new Date('2026-01-02') }),
  todayRangeInTz: jest.fn().mockReturnValue({ start: new Date('2026-01-01'), end: new Date('2026-01-02') }),
}));

describe('GetDashboardStatsHandler', () => {
  let handler: GetDashboardStatsHandler;
  let prisma: {
    employee: { findFirst: jest.Mock };
    booking: { groupBy: jest.Mock; count: jest.Mock };
    client: { count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      booking: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      client: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ pendingPayments: 0, todayRevenue: 0 }]),
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
    expect(result).toEqual({ todayBookings: 0, confirmedToday: 0, pendingToday: 0, cancelRequests: 0, newClientsToday: 0 });
    expect(prisma.booking.groupBy).not.toHaveBeenCalled();
  });

  it('returns booking stats for employee with linked row', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    prisma.booking.groupBy.mockResolvedValue([
      { status: 'CONFIRMED', _count: { _all: 3 } },
      { status: 'PENDING', _count: { _all: 1 } },
      { status: 'COMPLETED', _count: { _all: 1 } },
    ]);
    prisma.booking.count.mockResolvedValue(2);
    const result = await handler.execute({ userId: 'u1', role: 'EMPLOYEE' });
    expect(result.todayBookings).toBe(5);
    expect(result.confirmedToday).toBe(3);
    expect(result.pendingToday).toBe(1);
    expect(result.cancelRequests).toBe(2);
    expect(prisma.booking.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status'],
        where: expect.objectContaining({ employeeId: 'emp-1' }),
      }),
    );
    expect(prisma.booking.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ employeeId: 'emp-1' }) }),
    );
  });

  it('maps a status absent from groupBy results to 0', async () => {
    prisma.booking.groupBy.mockResolvedValue([
      { status: 'COMPLETED', _count: { _all: 4 } },
    ]);
    const result = await handler.execute({ userId: 'u1', role: 'RECEPTIONIST' });
    expect(result.todayBookings).toBe(4);
    expect(result.confirmedToday).toBe(0);
    expect(result.pendingToday).toBe(0);
  });

  it('returns stats with payment data for OWNER', async () => {
    prisma.$queryRaw.mockResolvedValue([{ pendingPayments: 3, todayRevenue: 1500.5 }]);
    const result = await handler.execute({ userId: 'u1', role: 'OWNER' });
    expect(result.pendingPayments).toBe(3);
    expect(result.todayRevenue).toBe(1500.5);
  });

  it('returns stats with payment data for ADMIN', async () => {
    prisma.$queryRaw.mockResolvedValue([{ pendingPayments: 1, todayRevenue: 0 }]);
    const result = await handler.execute({ userId: 'u1', role: 'ADMIN' });
    expect(result.pendingPayments).toBe(1);
    expect(result.todayRevenue).toBe(0);
  });

  it('returns stats without payment data for non-payment roles', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
    const result = await handler.execute({ userId: 'u1', role: 'EMPLOYEE' });
    expect(result.pendingPayments).toBeUndefined();
    expect(result.todayRevenue).toBeUndefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('uses empty role fallback for payment check', async () => {
    const result = await handler.execute({ userId: 'u1' });
    expect(result.pendingPayments).toBeUndefined();
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
