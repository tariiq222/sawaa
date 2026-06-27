import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { ListSessionPackagesHandler } from './list-session-packages.handler';

function buildPrisma() {
  return {
    sessionPackage: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

const SESSION_PRICE = {
  subtotal: 81000,
  discountAmount: 9000,
  finalPrice: 72000,
  fullValue: 90000,
  freeValue: 18000,
  itemUnitPrices: [] as unknown[],
  lines: [] as unknown[],
};

function buildPricing() {
  return {
    // P1-4: batched pricing — one computeMany per page, one price per group.
    computeMany: jest.fn().mockImplementation((groups: unknown[]) =>
      Promise.resolve(groups.map(() => SESSION_PRICE)),
    ),
    compute: jest.fn().mockResolvedValue({
      subtotal: 81000,
      discountAmount: 9000,
      finalPrice: 72000,
      fullValue: 90000,
      freeValue: 18000,
      itemUnitPrices: [],
      lines: [],
    }),
  };
}

describe('ListSessionPackagesHandler', () => {
  let handler: ListSessionPackagesHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let pricing: ReturnType<typeof buildPricing>;

  beforeEach(async () => {
    prisma = buildPrisma();
    pricing = buildPricing();
    const module = await Test.createTestingModule({
      providers: [
        ListSessionPackagesHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: ComputePackagePriceService, useValue: pricing },
      ],
    }).compile();
    handler = module.get(ListSessionPackagesHandler);
  });

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns an empty list when no packages match', async () => {
    const res = await handler.execute({});
    expect(res.items).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(res.meta.page).toBe(1);
    expect(res.meta.perPage).toBe(20);
  });

  it('always filters out archived packages', async () => {
    await handler.execute({});
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
  });

  it('applies isActive filter when provided', async () => {
    await handler.execute({ isActive: true } as any);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('applies isPublic filter when provided', async () => {
    await handler.execute({ isPublic: true } as any);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true }),
      }),
    );
  });

  it('builds a case-insensitive OR search over nameAr + nameEn', async () => {
    await handler.execute({ search: 'family' } as any);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { nameAr: { contains: 'family', mode: 'insensitive' } },
            { nameEn: { contains: 'family', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns total + items and computes meta correctly', async () => {
    prisma.sessionPackage.findMany.mockResolvedValue([
      { id: 'a', items: [] },
      { id: 'b', items: [] },
    ]);
    prisma.sessionPackage.count.mockResolvedValue(2);
    const res = await handler.execute({});
    expect(res.items).toHaveLength(2);
    expect(res.meta.total).toBe(2);
    expect(res.meta.totalPages).toBe(1);
    expect(res.meta.hasNextPage).toBe(false);
  });

  it('flattens the computed price onto each row so the dashboard sees real money', async () => {
    prisma.sessionPackage.findMany.mockResolvedValue([{ id: 'a', items: [] }]);
    prisma.sessionPackage.count.mockResolvedValue(1);
    const res = await handler.execute({});
    expect(pricing.computeMany).toHaveBeenCalledTimes(1);
    expect(res.items[0]).toEqual(
      expect.objectContaining({
        id: 'a',
        subtotal: 81000,
        discountAmount: 9000,
        finalPrice: 72000,
        fullValue: 90000,
        freeValue: 18000,
      }),
    );
  });

  it('honors a custom page + limit', async () => {
    await handler.execute({ page: 3, limit: 5 } as any);
    const call = prisma.sessionPackage.findMany.mock.calls[0][0];
    expect(call.skip).toBe(10); // (3 - 1) * 5
    expect(call.take).toBe(5);
  });

  it('orders by sortOrder then createdAt desc', async () => {
    await handler.execute({});
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  });
});