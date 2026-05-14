import { BookingExpiryCron } from './booking-expiry.cron';

describe('BookingExpiryCron', () => {
  // org scoping moved to RLS / removed in single-tenant migration — legacy flag-gated path removed,
  // execute() always uses enhancedExpire(). Tests rewritten as enhanced path smoke tests.
  describe('enhanced path — basic smoke (no stale bookings)', () => {
    const buildCls = () => ({
      run: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
      set: jest.fn(),
    });

    const buildPrisma = () => ({
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ v: BigInt(12345) }])
        .mockResolvedValueOnce([{ acquired: true }]),
      $allTenants: {
        booking: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        coupon: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      },
    });

    it('runs inside cls.run context and calls findMany', async () => {
      const prisma = buildPrisma();
      const cls = buildCls();
      const cron = new BookingExpiryCron(prisma as never, cls as never);
      await cron.execute();
      expect(cls.run).toHaveBeenCalledTimes(1);
      expect(prisma.$allTenants.booking.findMany).toHaveBeenCalledTimes(1);
    });

    it('does not call updateMany when no stale bookings found', async () => {
      const prisma = buildPrisma();
      const cls = buildCls();
      const cron = new BookingExpiryCron(prisma as never, cls as never);
      await cron.execute();
      expect(prisma.$allTenants.booking.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('enhanced path (flag on)', () => {
    const NOW = new Date('2026-05-04T12:00:00Z');
    beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime()));
    afterEach(() => jest.restoreAllMocks());

    const buildCls = () => ({
      run: jest.fn().mockImplementation((fn: () => Promise<void>) => fn()),
      set: jest.fn(),
    });

    const buildPrisma = () => ({
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ v: BigInt(12345) }])
        .mockResolvedValueOnce([{ acquired: true }]),
      $allTenants: {
        booking: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        coupon: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      },
    });

    it('expires PENDING/AWAITING_PAYMENT/PENDING_GROUP_FILL using $allTenants', async () => {
      const stale = [
        { id: 'b1', status: 'PENDING', couponCode: 'PROMO', organizationId: 'o1' },
        { id: 'b2', status: 'AWAITING_PAYMENT', couponCode: null, organizationId: 'o1' },
      ];
      const prisma = buildPrisma();
      prisma.$allTenants.booking.findMany.mockResolvedValue(stale);
      const _flags = { bookingExpiryEnabled: true };
      const cron = new BookingExpiryCron(prisma as never, buildCls() as never);
      await cron.execute();

      expect(prisma.$allTenants.booking.findMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
          status: { in: ['PENDING', 'AWAITING_PAYMENT', 'PENDING_GROUP_FILL'] },
        },
        select: { id: true, organizationId: true, couponCode: true },
      });
      expect(prisma.$allTenants.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2'] } },
        data: { status: 'EXPIRED' },
      });
      expect(prisma.$allTenants.coupon.updateMany).toHaveBeenCalledWith({
        where: { code: 'PROMO', organizationId: 'o1', usedCount: { gt: 0 } },
        data: { usedCount: { decrement: 1 } },
      });
    });

    it('idempotent: empty result is a no-op', async () => {
      const prisma = buildPrisma();
      const _flags = { bookingExpiryEnabled: true };
      const cron = new BookingExpiryCron(prisma as never, buildCls() as never);
      await cron.execute();
      expect(prisma.$allTenants.booking.findMany).toHaveBeenCalledTimes(1);
    });

    it('decrements coupon once per booking that had it (two bookings sharing code = two decrements)', async () => {
      const stale = [
        { id: 'b1', status: 'PENDING', couponCode: 'X', organizationId: 'o1' },
        { id: 'b2', status: 'PENDING', couponCode: 'X', organizationId: 'o1' },
        { id: 'b3', status: 'PENDING', couponCode: 'Y', organizationId: 'o2' },
      ];
      const prisma = buildPrisma();
      prisma.$allTenants.booking.findMany.mockResolvedValue(stale);
      const _flags = { bookingExpiryEnabled: true };
      const cron = new BookingExpiryCron(prisma as never, buildCls() as never);
      await cron.execute();
      const calls = prisma.$allTenants.coupon.updateMany.mock.calls;
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
