import { DiscountType, Prisma } from '@prisma/client';
import { ListPublicPackagesHandler } from './list-public-packages.handler';

const SERVICE_ID = '00000000-0000-4000-a000-000000000005';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000004';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000006';

/**
 * Per-item discount fields are now part of the item row. The package-level
 * discountType/discountValue stored in the DB is a neutral PERCENTAGE/0
 * sentinel and is NOT forwarded to compute().
 */
const publicItem = {
  id: 'item-1',
  packageId: 'pkg-1',
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  paidQuantity: 4,
  freeQuantity: 1,
  discountType: DiscountType.PERCENTAGE as DiscountType | null,
  discountValue: new Prisma.Decimal(10),
  sortOrder: 0,
};

const publicPackage = {
  id: 'pkg-1',
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  // Neutral package-level sentinel — never fed into compute().
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(0),
  isActive: true,
  isPublic: true,
  archivedAt: null,
  sortOrder: 0,
  items: [publicItem],
};

function buildPrisma() {
  return { sessionPackage: { findMany: jest.fn() } };
}

const PUBLIC_PRICE = {
  subtotal: 40_000,
  discountAmount: 4_000,
  finalPrice: 36_000,
  itemUnitPrices: [{ durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 }],
};

function buildPricing() {
  return {
    // P1-4: the handler batches all packages through computeMany — one call per
    // page returning one price per group.
    computeMany: jest.fn().mockImplementation((groups: unknown[]) =>
      Promise.resolve(groups.map(() => PUBLIC_PRICE)),
    ),
  };
}

/**
 * Minimal in-memory stand-in for CacheService.getOrSet that mirrors the real
 * read-through semantics: serve a cached value if present, otherwise run the
 * loader once and remember its result under the key.
 */
function buildCache() {
  const store = new Map<string, unknown>();
  return {
    getOrSet: jest.fn(async (key: string, loader: () => Promise<unknown>, _ttl?: number) => {
      if (store.has(key)) return store.get(key);
      const value = await loader();
      store.set(key, value);
      return value;
    }),
    invalidatePrefix: jest.fn(),
  };
}

function buildHandler(
  prisma = buildPrisma(),
  pricing = buildPricing(),
  cache = buildCache(),
) {
  const handler = new ListPublicPackagesHandler(
    prisma as never,
    pricing as never,
    cache as never,
  );
  return { handler, prisma, pricing, cache };
}

describe('ListPublicPackagesHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('queries ONLY public + active + non-archived packages', async () => {
    const { handler, prisma } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([]);

    await handler.execute();

    expect(prisma.sessionPackage.findMany).toHaveBeenCalledTimes(1);
    const arg = prisma.sessionPackage.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ isPublic: true, isActive: true, archivedAt: null });
    // Ordering mirrors the dashboard list.
    expect(arg.orderBy).toEqual([{ sortOrder: 'asc' }, { createdAt: 'desc' }]);
  });

  it('decorates every package with the canonical computed price using per-item discount fields', async () => {
    const { handler, prisma, pricing } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([publicPackage]);

    const result = await handler.execute();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pkg-1');
    expect(result[0].price).toEqual(PUBLIC_PRICE);
    // computeMany is called with one item-group per package, each carrying the
    // per-item discount fields (no package-level discountType/discountValue).
    expect(pricing.computeMany).toHaveBeenCalledWith([
      [
        {
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          paidQuantity: 4,
          freeQuantity: 1,
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
        },
      ],
    ]);
  });

  it('returns an empty array when no public packages exist (no crash)', async () => {
    const { handler, prisma, pricing } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([]);

    const result = await handler.execute();

    expect(result).toEqual([]);
    // computeMany is invoked with an empty batch and returns [].
    expect(pricing.computeMany).toHaveBeenCalledWith([]);
  });

  it('caches the catalog: the loader runs once across two calls (P1-20)', async () => {
    const { handler, prisma, pricing, cache } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([publicPackage]);

    const first = await handler.execute();
    const second = await handler.execute();

    // Same payload served both times, but the underlying loader (DB + pricing)
    // executed exactly once — the second call is a cache hit.
    expect(second).toEqual(first);
    expect(cache.getOrSet).toHaveBeenCalledTimes(2);
    expect(cache.getOrSet.mock.calls[0][0]).toBe('ref:public-packages');
    expect(cache.getOrSet.mock.calls[0][2]).toBe(300);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledTimes(1);
    expect(pricing.computeMany).toHaveBeenCalledTimes(1);
  });

  it('prices each package independently when several are public', async () => {
    const { handler, prisma, pricing } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([
      publicPackage,
      { ...publicPackage, id: 'pkg-2', items: [{ ...publicItem, packageId: 'pkg-2' }] },
    ]);

    const result = await handler.execute();

    expect(result).toHaveLength(2);
    // One batched call for the whole page (not one-per-package).
    expect(pricing.computeMany).toHaveBeenCalledTimes(1);
    expect((pricing.computeMany as jest.Mock).mock.calls[0][0]).toHaveLength(2);
  });
});
