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
