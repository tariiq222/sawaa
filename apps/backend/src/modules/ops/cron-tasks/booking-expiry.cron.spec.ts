import { BookingExpiryCron } from './booking-expiry.cron';

describe('BookingExpiryCron', () => {
  const buildPrisma = (bookings: { id: string }[] = []) => ({
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([{ v: BigInt(12345) }])
      .mockResolvedValueOnce([{ acquired: true }]),
    booking: {
      findMany: jest.fn().mockResolvedValue(bookings),
    },
  });

  const buildHandler = () => ({
    execute: jest.fn().mockResolvedValue(undefined),
  });

  describe('no stale bookings', () => {
    it('calls findMany with correct filter and take:100', async () => {
      const prisma = buildPrisma();
      const handler = buildHandler();
      const cron = new BookingExpiryCron(prisma as never, handler as never);
      await cron.execute();
      expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('does not call handler when no stale bookings found', async () => {
      const prisma = buildPrisma();
      const handler = buildHandler();
      const cron = new BookingExpiryCron(prisma as never, handler as never);
      await cron.execute();
      expect(handler.execute).not.toHaveBeenCalled();
    });
  });

  describe('with stale bookings', () => {
    const NOW = new Date('2026-05-04T12:00:00Z');
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime()));
    afterEach(() => jest.restoreAllMocks());

    it('calls handler.execute for each stale booking', async () => {
      const stale = [{ id: 'b1' }, { id: 'b2' }];
      const prisma = buildPrisma(stale);
      const handler = buildHandler();
      const cron = new BookingExpiryCron(prisma as never, handler as never);
      await cron.execute();

      expect(handler.execute).toHaveBeenCalledTimes(2);
      expect(handler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 'b1', changedBy: expect.any(String) }),
      );
      expect(handler.execute).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 'b2', changedBy: expect.any(String) }),
      );
    });

    it('queries with correct status filter', async () => {
      const prisma = buildPrisma();
      const handler = buildHandler();
      const cron = new BookingExpiryCron(prisma as never, handler as never);
      await cron.execute();

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            expiresAt: { lt: expect.any(Date) },
            status: { in: ['PENDING', 'AWAITING_PAYMENT'] },
          },
          select: { id: true },
          take: 100,
        }),
      );
    });

    it('does not throw when handler rejects for one booking', async () => {
      const stale = [{ id: 'b1' }, { id: 'b2' }];
      const prisma = buildPrisma(stale);
      const handler = buildHandler();
      handler.execute
        .mockRejectedValueOnce(new Error('already expired'))
        .mockResolvedValueOnce(undefined);
      const cron = new BookingExpiryCron(prisma as never, handler as never);
      await expect(cron.execute()).resolves.toBeUndefined();
    });
  });
});
