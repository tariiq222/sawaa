import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database';
import { DiscountType } from '@prisma/client';
import { GetSessionPackageHandler } from './get-session-package.handler';
import { ComputePackagePriceService } from '../../compute-package-price.service';

function buildPrisma() {
  return {
    sessionPackage: {
      findFirst: jest.fn(),
    },
    employeeService: { findFirst: jest.fn(), findMany: jest.fn() },
    employeeServiceOption: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    serviceDurationOption: { findFirst: jest.fn(), findMany: jest.fn() },
  };
}

const PACKAGE_ID = '00000000-0000-4000-a000-0000000000aa';
const SERVICE_ID = '00000000-0000-4000-a000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000002';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000003';

/**
 * Base fixture item. discountType/discountValue are per-item now.
 * The package-level discountType/discountValue stored in the DB is a neutral
 * PERCENTAGE/0 sentinel and is never fed into compute().
 */
const fixtureItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  paidQuantity: 4,
  freeQuantity: 0,
  discountType: null as DiscountType | null,
  discountValue: { toString: () => '0' },
  sortOrder: 0,
  ...overrides,
});

const fixturePackage = (itemOverrides: Record<string, unknown> = {}) => ({
  id: PACKAGE_ID,
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  // Package-level discount is now a neutral sentinel — compute() ignores it.
  discountType: DiscountType.PERCENTAGE,
  discountValue: { toString: () => '0' },
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  archivedAt: null,
  items: [fixtureItem(itemOverrides)],
});

describe('GetSessionPackageHandler', () => {
  let handler: GetSessionPackageHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'es-1' });
    prisma.employeeService.findMany.mockResolvedValue([
      { id: 'es-1', employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID },
    ]);
    prisma.employeeServiceOption.findFirst.mockResolvedValue(null);
    prisma.serviceDurationOption.findFirst.mockResolvedValue({
      id: DURATION_OPTION_ID,
      serviceId: SERVICE_ID,
      price: { toString: () => '10000' },
    });
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: DURATION_OPTION_ID, serviceId: SERVICE_ID, price: { toString: () => '10000' } },
    ]);

    const module = await Test.createTestingModule({
      providers: [
        GetSessionPackageHandler,
        ComputePackagePriceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = module.get(GetSessionPackageHandler);
  });

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws NotFoundException when the package is missing', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ packageId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the package is archived', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ packageId: 'archived' })).rejects.toThrow(NotFoundException);
  });

  it('always filters out archived packages at the query level', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(fixturePackage());
    await handler.execute({ packageId: PACKAGE_ID });
    expect(prisma.sessionPackage.findFirst).toHaveBeenCalledWith({
      where: { id: PACKAGE_ID, archivedAt: null },
      include: {
        items: {
          orderBy: { sortOrder: 'asc' },
          include: { constraints: { include: { targets: true } } },
        },
      },
    });
  });

  it('returns the package with no discount when item has no per-item discount (4×10000 = 40000 subtotal, 0 off)', async () => {
    // Item has discountType: null → no discount → subtotal = finalPrice.
    prisma.sessionPackage.findFirst.mockResolvedValue(fixturePackage());
    const result = await handler.execute({ packageId: PACKAGE_ID });
    expect(result.id).toBe(PACKAGE_ID);
    expect(result.price.subtotal).toBe(40_000);
    expect(result.price.discountAmount).toBe(0);
    expect(result.price.finalPrice).toBe(40_000);
    expect(result.price.itemUnitPrices).toEqual([
      { durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 },
    ]);
  });

  it('computes correctly when the item carries a PERCENTAGE discount', async () => {
    // Item has 10% per-item discount: 10% of (4 × 10_000) = 4_000 off.
    prisma.sessionPackage.findFirst.mockResolvedValue(
      fixturePackage({ discountType: DiscountType.PERCENTAGE, discountValue: { toString: () => '10' } }),
    );
    const result = await handler.execute({ packageId: PACKAGE_ID });
    expect(result.price.subtotal).toBe(40_000);
    expect(result.price.discountAmount).toBe(4_000);
    expect(result.price.finalPrice).toBe(36_000);
  });

  it('computes correctly when the item carries a FIXED discount in integer halalas', async () => {
    // Item has FIXED 5_000 halalas discount on a 40_000 halalas payable.
    prisma.sessionPackage.findFirst.mockResolvedValue(
      fixturePackage({ discountType: DiscountType.FIXED, discountValue: { toString: () => '5000' } }),
    );
    const result = await handler.execute({ packageId: PACKAGE_ID });
    expect(result.price.subtotal).toBe(40_000);
    expect(result.price.discountAmount).toBe(5_000);
    expect(result.price.finalPrice).toBe(35_000);
  });
});
