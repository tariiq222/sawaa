import { BookingExpiryCron } from './booking-expiry.cron';

describe('BookingExpiryCron', () => {
  const buildPrisma = (bookings: { id: string }[] = []) => ({
    $queryRaw: jest.fn()
      .mockResolvedValueOnce([{ acquired: true }]),
    $executeRaw: jest.fn().mockResolvedValue(1),
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
            isHistoricalImport: false,
            status: { in: ['PENDING', 'AWAITING_PAYMENT'] },
            OR: [
              { expiresAt: { lt: expect.any(Date) } },
              { expiresAt: null, createdAt: { lt: expect.any(Date) } },
            ],
          },
          select: { id: true },
          take: 100,
        }),
      );
    });

    it('falls back to an age cutoff one hour back for rows with no expiresAt', async () => {
      const prisma = buildPrisma();
      const handler = buildHandler();
      const cron = new BookingExpiryCron(prisma as never, handler as never);
      await cron.execute();

      const call = prisma.booking.findMany.mock.calls[0][0] as {
        where: {
          OR: Array<{
            expiresAt: { lt: Date } | null;
            createdAt?: { lt: Date };
          }>;
        };
      };
      const expiryBranch = call.where.OR.find((branch) => branch.expiresAt !== null);
      const nullBranch = call.where.OR.find((branch) => branch.expiresAt === null);
      expect(nullBranch).toBeDefined();
      // NULL rows are only overdue once they are older than the fallback age —
      // longer than every real window (15/30 min) so the normal path wins.
      // Compared against the same tick clock the cron stamped on branch 1 so
      // the assertion does not depend on the wall clock.
      const tickNow = (expiryBranch!.expiresAt as { lt: Date }).lt;
      expect(tickNow.getTime() - nullBranch!.createdAt!.lt.getTime()).toBe(
        60 * 60 * 1000,
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
