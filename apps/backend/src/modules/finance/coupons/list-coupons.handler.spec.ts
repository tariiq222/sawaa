import { ListCouponsHandler } from './list-coupons.handler';

describe('ListCouponsHandler', () => {
  let handler: ListCouponsHandler;
  let prisma: { $transaction: jest.Mock; coupon: { findMany: jest.Mock; count: jest.Mock } };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((cb: any) => cb(prisma)),
      coupon: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    };
    const rlsTransaction = { withTransaction: jest.fn((fn: any) => fn(prisma)) };
    handler = new ListCouponsHandler(prisma as any, rlsTransaction as any);
  });

  it('lists with defaults', async () => {
    const result = await handler.execute({});
    expect(result.items).toEqual([]);
    expect(result.meta.page).toBe(1);
    expect(result.meta.perPage).toBe(20);
  });

  it('filters by search', async () => {
    await handler.execute({ search: 'SUMMER' });
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ code: { contains: 'SUMMER', mode: 'insensitive' } }),
      }),
    );
  });

  it('filters by active status', async () => {
    await handler.execute({ status: 'active' });
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it('filters by inactive status', async () => {
    await handler.execute({ status: 'inactive' });
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
    );
  });

  it('filters by expired status', async () => {
    await handler.execute({ status: 'expired' });
    expect(prisma.coupon.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          expiresAt: { lt: expect.any(Date) },
          isActive: true,
        }),
      }),
    );
  });

  it('uses custom pagination', async () => {
    const result = await handler.execute({ page: 2, limit: 10 });
    expect(result.meta.page).toBe(2);
    expect(result.meta.perPage).toBe(10);
  });
});
