import { ListBookingsHandler } from './list-bookings.handler';
import { buildPrisma, mockBooking } from '../testing/booking-test-helpers';
import { BookingStatus } from '@prisma/client';

describe('ListBookingsHandler', () => {
  it('returns paginated bookings', async () => {
    const prisma = buildPrisma();
    prisma.booking.findMany = jest.fn().mockResolvedValue([mockBooking]);
    const result = await new ListBookingsHandler(prisma as never).execute({
      page: 1, limit: 10,
    });
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('filters by status when provided', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ status: BookingStatus.CONFIRMED, page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: BookingStatus.CONFIRMED }) }),
    );
  });

  it('filters by branchId and employeeId', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({ branchId: 'branch-1', employeeId: 'emp-1', page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ branchId: 'branch-1', employeeId: 'emp-1' }),
      }),
    );
  });

  it('includes date range filtering', async () => {
    const prisma = buildPrisma();
    const handler = new ListBookingsHandler(prisma as never);
    const fromDate = new Date('2026-01-01');
    const toDate = new Date('2026-01-31');
    await handler.execute({ fromDate, toDate, page: 1, limit: 10 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scheduledAt: { gte: fromDate, lte: toDate } }),
      }),
    );
  });

  it('returns correct pagination metadata', async () => {
    const prisma = buildPrisma();
    prisma.booking.count = jest.fn().mockResolvedValue(25);
    const handler = new ListBookingsHandler(prisma as never);
    const result = await handler.execute({ page: 2, limit: 10 });
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.page).toBe(2);
    expect(result.meta.perPage).toBe(10);
  });

  it('auto-filters by Employee when membershipRole=EMPLOYEE', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst = jest.fn().mockResolvedValueOnce({ id: 'emp-9' });
    const handler = new ListBookingsHandler(prisma as never);
    await handler.execute({
      membershipRole: 'EMPLOYEE',
      userId: 'user-emp',
      page: 1,
      limit: 10,
    });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ employeeId: 'emp-9' }),
      }),
    );
  });

  it('returns empty page for EMPLOYEE with no Employee row', async () => {
    const prisma = buildPrisma();
    prisma.employee.findFirst = jest.fn().mockResolvedValueOnce(null);
    prisma.booking.findMany = jest.fn();
    const handler = new ListBookingsHandler(prisma as never);
    const result = await handler.execute({
      membershipRole: 'EMPLOYEE',
      userId: 'orphan',
      page: 1,
      limit: 10,
    });
    expect(result.items).toEqual([]);
    expect(result.meta.total).toBe(0);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });
});
