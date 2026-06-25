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
    employeeService: { findFirst: jest.fn() },
    employeeServiceOption: { findFirst: jest.fn() },
    serviceDurationOption: { findFirst: jest.fn() },
  };
}

const PACKAGE_ID = '00000000-0000-4000-a000-0000000000aa';
const SERVICE_ID = '00000000-0000-4000-a000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000002';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000003';

const fixturePackage = (overrides: Record<string, unknown> = {}) => ({
  id: PACKAGE_ID,
  nameAr: 'باقة العائلة',
  nameEn: 'Family Pack',
  discountType: DiscountType.PERCENTAGE,
  discountValue: { toString: () => '10' },
  isActive: true,
  isPublic: true,
  sortOrder: 0,
  archivedAt: null,
  items: [
    {
      id: 'item-1',
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_OPTION_ID,
      paidQuantity: 4,
      freeQuantity: 0,
      sortOrder: 0,
    },
  ],
  ...overrides,
});

describe('GetSessionPackageHandler', () => {
  let handler: GetSessionPackageHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'es-1' });
    prisma.employeeServiceOption.findFirst.mockResolvedValue(null);
    prisma.serviceDurationOption.findFirst.mockResolvedValue({
      id: DURATION_OPTION_ID,
      serviceId: SERVICE_ID,
      price: { toString: () => '10000' },
    });

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
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });
  });

  it('returns the package decorated with the computed price (PERCENTAGE 10% on 4×10000)', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(fixturePackage());
    const result = await handler.execute({ packageId: PACKAGE_ID });
    expect(result.id).toBe(PACKAGE_ID);
    expect(result.price.subtotal).toBe(40_000);
    expect(result.price.discountAmount).toBe(4_000);
    expect(result.price.finalPrice).toBe(36_000);
    expect(result.price.itemUnitPrices).toEqual([
      { durationOptionId: DURATION_OPTION_ID, unitPrice: 10_000 },
    ]);
  });

  it('computes correctly for FIXED discounts in halalas', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(
      fixturePackage({ discountType: DiscountType.FIXED, discountValue: { toString: () => '5000' } }),
    );
    const result = await handler.execute({ packageId: PACKAGE_ID });
    expect(result.price.subtotal).toBe(40_000);
    expect(result.price.discountAmount).toBe(5_000);
    expect(result.price.finalPrice).toBe(35_000);
  });
});