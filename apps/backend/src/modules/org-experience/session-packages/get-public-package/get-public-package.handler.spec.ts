import { NotFoundException } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { GetPublicPackageHandler } from './get-public-package.handler';

const PACKAGE_ID = '00000000-0000-4000-a000-000000000001';
const SERVICE_ID = '00000000-0000-4000-a000-000000000005';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000004';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000006';

const publicPackage = {
  id: PACKAGE_ID,
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  discountType: DiscountType.PERCENTAGE,
  discountValue: new Prisma.Decimal(10),
  isActive: true,
  isPublic: true,
  archivedAt: null,
  items: [
    {
      id: 'item-1',
      packageId: PACKAGE_ID,
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_OPTION_ID,
      paidQuantity: 4,
      freeQuantity: 1,
      sortOrder: 0,
    },
  ],
};

function buildPrisma() {
  return { sessionPackage: { findFirst: jest.fn() } };
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
  const handler = new GetPublicPackageHandler(prisma as never, pricing as never);
  return { handler, prisma, pricing };
}

describe('GetPublicPackageHandler', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns the package decorated with the computed price when public+active', async () => {
    const { handler, prisma } = buildHandler();
    prisma.sessionPackage.findFirst.mockResolvedValue(publicPackage);

    const result = await handler.execute({ packageId: PACKAGE_ID });

    expect(result.id).toBe(PACKAGE_ID);
    expect(result.price.finalPrice).toBe(36_000);
  });

  it('scopes the lookup to public + active + non-archived (cannot reach private packages by id)', async () => {
    const { handler, prisma } = buildHandler();
    prisma.sessionPackage.findFirst.mockResolvedValue(publicPackage);

    await handler.execute({ packageId: PACKAGE_ID });

    const arg = prisma.sessionPackage.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({
      id: PACKAGE_ID,
      isPublic: true,
      isActive: true,
      archivedAt: null,
    });
  });

  it('throws NotFoundException when the package is not found / not public', async () => {
    // The scoped where-clause already excludes private/archived/inactive rows,
    // so the handler simply receives null for any of those cases.
    const { handler, prisma } = buildHandler();
    prisma.sessionPackage.findFirst.mockResolvedValue(null);

    await expect(handler.execute({ packageId: PACKAGE_ID })).rejects.toThrow(NotFoundException);
  });
});
