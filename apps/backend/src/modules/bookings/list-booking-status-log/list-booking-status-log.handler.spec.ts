import { BookingStatus } from '@prisma/client';
import { ListBookingStatusLogHandler } from './list-booking-status-log.handler';
import { buildPrisma } from '../testing/booking-test-helpers';

describe('ListBookingStatusLogHandler', () => {
  const mockLog = {
    id: 'log-1',
    bookingId: 'book-1',
    fromStatus: BookingStatus.PENDING,
    toStatus: BookingStatus.CONFIRMED,
    changedBy: 'user-42',
    reason: null,
    createdAt: new Date(),
  };

  it('returns logs ordered by createdAt asc for a booking', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = {
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      findMany: jest.fn().mockResolvedValue([mockLog]),
    };
    const handler = new ListBookingStatusLogHandler(prisma as never);

    const result = await handler.execute({ bookingId: 'book-1' });

    expect((prisma as any).bookingStatusLog.findMany).toHaveBeenCalledWith({
      where: { bookingId: 'book-1' },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([mockLog]);
  });

  it('returns empty array when booking has no log entries', async () => {
    const prisma = buildPrisma();
    (prisma as any).bookingStatusLog = {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const handler = new ListBookingStatusLogHandler(prisma as never);

    const result = await handler.execute({ bookingId: 'no-logs' });

    expect(result).toEqual([]);
  });
});


describe('ListBookingStatusLogHandler ownership', () => {
  it.each([['employee-b', 'user-a', 'EMPLOYEE', false], ['employee-a', undefined, 'EMPLOYEE', false], ['employee-a', 'user-a', 'EMPLOYEE', true], ['employee-b', 'admin', 'ADMIN', true]])('checks %s / %s / %s before nested reads', async (employeeId, requesterUserId, requesterRole, allowed) => {
    const prisma = { employee: { findFirst: jest.fn().mockResolvedValue({ id: 'employee-a' }) }, booking: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', employeeId, createdAt: new Date() }) }, bookingStatusLog: { findMany: jest.fn().mockResolvedValue([]) }, invoice: { findMany: jest.fn().mockResolvedValue([]) }, activityLog: { findMany: jest.fn().mockResolvedValue([]) } };
    const action = new ListBookingStatusLogHandler(prisma as any).execute({ bookingId: 'b1', requesterRole, requesterUserId } as any);
    if (allowed) await expect(action).resolves.toBeInstanceOf(Array);
    else { await expect(action).rejects.toThrow(); expect(prisma.bookingStatusLog.findMany).not.toHaveBeenCalled(); expect(prisma.invoice.findMany).not.toHaveBeenCalled(); expect(prisma.activityLog.findMany).not.toHaveBeenCalled(); }
  });
});
