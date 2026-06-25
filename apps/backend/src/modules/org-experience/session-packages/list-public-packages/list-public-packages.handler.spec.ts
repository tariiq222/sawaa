import { DiscountType, Prisma } from '@prisma/client';
import { ListPublicPackagesHandler } from './list-public-packages.handler';

const SERVICE_ID = '00000000-0000-4000-a000-000000000005';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000004';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000006';

const publicItem = {
  id: 'item-1',
  packageId: 'pkg-1',
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  paidQuantity: 4,
  freeQuantity: 1,
  sortOrder: 0,
};

const publicPackage = {
  id: 'pkg-1',
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  isActive: true,
  isPublic: true,
  archivedAt: null,
  sortOrder: 0,
  items: [publicItem],
};

function buildPrisma() {
  return { sessionPackage: { findMany: jest.fn() } };
}

function buildPricing() {
  return {
    compute: jest.fn().mockResolvedValue({
      subtotal: 40_000,
      discountAmount: 4_000,
      finalPrice: 36_000,
      itemUnitPrices: [{ durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 }],
    }),
  };
}

function buildHandler(prisma = buildPrisma(), pricing = buildPricing()) {
  const handler = new ListPublicPackagesHandler(prisma as never, pricing as never);
  return { handler, prisma, pricing };
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

  it('decorates every package with the canonical computed price', async () => {
    const { handler, prisma, pricing } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([publicPackage]);

    const result = await handler.execute();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pkg-1');
    expect(result[0].price).toEqual({
      subtotal: 40_000,
      discountAmount: 4_000,
      finalPrice: 36_000,
      itemUnitPrices: [{ durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 }],
    });
    // Price is computed from the SAME inputs the reception sale freezes.
    expect(pricing.compute).toHaveBeenCalledWith({
      items: [
        {
          serviceId: SERVICE_ID,
          employeeId: EMPLOYEE_ID,
          durationOptionId: DURATION_OPTION_ID,
          paidQuantity: 4,
          freeQuantity: 1,
        },
      ],
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
    });
  });

  it('returns an empty array when no public packages exist (no crash)', async () => {
    const { handler, prisma, pricing } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([]);

    const result = await handler.execute();

    expect(result).toEqual([]);
    expect(pricing.compute).not.toHaveBeenCalled();
  });

  it('prices each package independently when several are public', async () => {
    const { handler, prisma, pricing } = buildHandler();
    prisma.sessionPackage.findMany.mockResolvedValue([
      publicPackage,
      { ...publicPackage, id: 'pkg-2', items: [{ ...publicItem, packageId: 'pkg-2' }] },
    ]);

    const result = await handler.execute();

    expect(result).toHaveLength(2);
    expect(pricing.compute).toHaveBeenCalledTimes(2);
  });
});
