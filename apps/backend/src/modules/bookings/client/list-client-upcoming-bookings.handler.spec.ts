import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { ListClientUpcomingBookingsHandler } from './list-client-upcoming-bookings.handler';

describe('ListClientUpcomingBookingsHandler', () => {
  const prisma = {
    booking: { findMany: jest.fn(), count: jest.fn() },
  };
  const handler = new ListClientUpcomingBookingsHandler(prisma as unknown as PrismaService);
  const now = new Date('2026-06-01T00:00:00Z');

  beforeEach(() => jest.clearAllMocks());

  it('returns pending, confirmed and deposit-confirmed bookings from now, oldest first', async () => {
    prisma.booking.findMany.mockResolvedValue([{ id: 'b-1' }]);
    prisma.booking.count.mockResolvedValue(1);

    await expect(handler.execute({ clientId: 'client-1', now })).resolves.toEqual({
      data: [{ id: 'b-1' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    });

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        clientId: 'client-1',
        scheduledAt: { gte: now },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.DEPOSIT_PAID] },
      },
      orderBy: { scheduledAt: 'asc' },
      skip: 0,
      take: 10,
    });
  });

  it('applies page and limit', async () => {
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.count.mockResolvedValue(0);

    await handler.execute({ clientId: 'client-1', page: 2, limit: 5, now });

    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
  });
});
