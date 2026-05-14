import { BookingExpiryCron } from './booking-expiry.cron';

describe('BookingExpiryCron', () => {
  describe('basic smoke (no stale bookings)', () => {
    const buildPrisma = () => ({
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ v: BigInt(12345) }])
        .mockResolvedValueOnce([{ acquired: true }]),
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      coupon: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    });

    it('calls findMany', async () => {
      const prisma = buildPrisma();
      const cron = new BookingExpiryCron(prisma as never);
      await cron.execute();
      expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    });

    it('does not call updateMany when no stale bookings found', async () => {
      const prisma = buildPrisma();
      const cron = new BookingExpiryCron(prisma as never);
      await cron.execute();
      expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('enhanced path', () => {
    const NOW = new Date('2026-05-04T12:00:00Z');
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime()));
    afterEach(() => jest.restoreAllMocks());

    const buildPrisma = () => ({
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ v: BigInt(12345) }])
        .mockResolvedValueOnce([{ acquired: true }]),
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    });

    it('expires PENDING/AWAITING_PAYMENT/PENDING_GROUP_FILL bookings', async () => {
      const stale = [
        { id: 'b1', status: 'PENDING', couponCode: 'PROMO' },
        { id: 'b2', status: 'AWAITING_PAYMENT', couponCode: null },
      ];
      const prisma = buildPrisma();
      prisma.booking.findMany.mockResolvedValue(stale);
      const cron = new BookingExpiryCron(prisma as never);
      await cron.execute();

      expect(prisma.booking.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PENDING_GROUP_FILL'] },
        },
        select: { id: true, couponCode: true },
      });
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2'] } },
        data: { status: 'EXPIRED' },
      });
      expect(prisma.coupon.updateMany).toHaveBeenCalledWith({
        where: { code: 'PROMO', usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    });

    it('idempotent: empty result is a no-op', async () => {
      const prisma = buildPrisma();
      const cron = new BookingExpiryCron(prisma as never);
      await cron.execute();
      expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
    });

    it('decrements coupon once per booking that had it', async () => {
      const stale = [
        { id: 'b1', status: 'PENDING', couponCode: 'X' },
        { id: 'b2', status: 'PENDING', couponCode: 'X' },
        { id: 'b3', status: 'PENDING', couponCode: 'Y' },
      ];
      const prisma = buildPrisma();
      prisma.booking.findMany.mockResolvedValue(stale);
      const cron = new BookingExpiryCron(prisma as never);
      await cron.execute();
      const calls = prisma.coupon.updateMany.mock.calls;
      expect(calls.length).toBe(3);
      expect(
        calls.filter(([c]: [{ where: { code: string } }]) => c.where.code === 'X').length,
      ).toBe(2);
      expect(
        calls.filter(([c]: [{ where: { code: string } }]) => c.where.code === 'Y').length,
      ).toBe(1);
    });
  });
});
