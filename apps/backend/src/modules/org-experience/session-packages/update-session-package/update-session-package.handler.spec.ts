import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { DiscountType, PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';
import { UpdateSessionPackageHandler } from './update-session-package.handler';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { CacheService } from '../../../../infrastructure/cache';

const cacheProvider = { provide: CacheService, useValue: { invalidatePrefix: jest.fn() } };

/**
 * Build a per-test Prisma stub. `validatePackageItems` (package-constraints.helper)
 * issues bulk queries directly against `this.prisma` (service/employee/serviceDurationOption
 * findMany + employeeService findMany for single-specific links); the pricing service
 * additionally reads employeeService/employeeServiceOption/serviceDurationOption to resolve
 * unit prices. The transaction wrapper hands its callback a `tx` proxy used only for the
 * item delete + per-item create + package update.
 */
function buildPrisma() {
  const sessionPackageFindFirst = jest.fn();
  const service = { findMany: jest.fn() };
  const employee = { findMany: jest.fn() };
  const employeeService = { findMany: jest.fn(), findFirst: jest.fn() };
  const serviceDurationOption = { findMany: jest.fn(), findFirst: jest.fn() };
  const sessionPackageItemDeleteMany = jest.fn();
  const sessionPackageItemCreate = jest.fn();
  const sessionPackageUpdate = jest.fn();
  const tx = {
    sessionPackage: { update: sessionPackageUpdate },
    sessionPackageItem: {
      deleteMany: sessionPackageItemDeleteMany,
      create: sessionPackageItemCreate,
    },
  };
  return {
    sessionPackage: { findFirst: sessionPackageFindFirst },
    service,
    employee,
    employeeService,
    employeeServiceOption: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    serviceDurationOption,
    _tx: tx,
  };
}

const PACKAGE_ID = '00000000-0000-4000-a000-0000000000aa';
const SERVICE_ID = '00000000-0000-4000-a000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000002';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000003';

const existingPackage = () => ({
  id: PACKAGE_ID,
  nameAr: 'باقة قديمة',
  nameEn: 'Old Pack',
  descriptionAr: null,
  descriptionEn: null,
  imageUrl: null,
  iconName: null,
  iconBgColor: null,
  discountType: DiscountType.PERCENTAGE,
  discountValue: { toString: () => '0' },
  isActive: true,
  isPublic: false,
  sortOrder: 0,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'item-1',
      packageId: PACKAGE_ID,
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      durationOptionId: DURATION_OPTION_ID,
      paidQuantity: 4,
      freeQuantity: 0,
      discountType: null,
      discountValue: { toString: () => '0' },
      sortOrder: 0,
      createdAt: new Date(),
    },
  ],
});

const validUpdate = () => ({ nameAr: 'باقة محدّثة' });

describe('UpdateSessionPackageHandler', () => {
  let handler: UpdateSessionPackageHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let tx: ReturnType<typeof buildPrisma>['_tx'];

  beforeEach(async () => {
    prisma = buildPrisma();
    tx = prisma._tx;
    prisma.sessionPackage.findFirst.mockResolvedValue(existingPackage());

    // validatePackageItems bulk lookups (legacy triple → single INCLUDE constraint each).
    prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);
    prisma.employee.findMany.mockResolvedValue([{ id: EMPLOYEE_ID }]);
    // Same findMany mock backs both validatePackageItems' existence/isActive check
    // (needs id/serviceId) and ComputePackagePriceService's durationMap (needs price).
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: DURATION_OPTION_ID, serviceId: SERVICE_ID, price: { toString: () => '10000' } },
    ]);
    // Same findMany mock backs both validatePackageItems' link check (needs
    // employeeId/serviceId) and ComputePackagePriceService's linkMap (needs id too).
    prisma.employeeService.findMany.mockResolvedValue([
      { id: 'es-1', employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID },
    ]);

    // Pricing-service lookups (unit price resolution for the legacy triple).
    prisma.employeeService.findFirst.mockResolvedValue({ id: 'es-1' });
    prisma.employeeServiceOption.findFirst.mockResolvedValue(null);
    prisma.serviceDurationOption.findFirst.mockResolvedValue({
      id: DURATION_OPTION_ID,
      serviceId: SERVICE_ID,
      price: { toString: () => '10000' },
    });

    tx.sessionPackageItem.deleteMany.mockResolvedValue({ count: 1 });
    tx.sessionPackageItem.create.mockResolvedValue({ id: 'new-item-1' });
    tx.sessionPackage.update.mockResolvedValue({ id: PACKAGE_ID });

    const module = await Test.createTestingModule({
      providers: [
        UpdateSessionPackageHandler,
        ComputePackagePriceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) },
        },
        cacheProvider,
      ],
    }).compile();

    handler = module.get(UpdateSessionPackageHandler);
  });

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('throws NotFoundException when the package does not exist', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ packageId: 'missing', ...validUpdate() } as any)).rejects.toThrow(NotFoundException);
    expect(tx.sessionPackage.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the package is archived', async () => {
    prisma.sessionPackage.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ packageId: 'archived', ...validUpdate() } as any)).rejects.toThrow(NotFoundException);
  });

  it('updates a single field without touching the rest', async () => {
    const result = await handler.execute({ packageId: PACKAGE_ID, nameAr: 'باقة محدّثة' } as any);
    expect(prisma.sessionPackage.findFirst).toHaveBeenCalledWith({
      where: { id: PACKAGE_ID, archivedAt: null },
      include: { items: true },
    });
    const data = tx.sessionPackage.update.mock.calls[0][0].data;
    expect(data.nameAr).toBe('باقة محدّثة');
    // Package-level discount fields must never appear in the update payload.
    expect(data.discountValue).toBeUndefined();
    expect(data.discountType).toBeUndefined();
    expect(result).toEqual({ id: PACKAGE_ID });
  });

  it('never writes package-level discountType or discountValue in any update path', async () => {
    // Even if a deprecated discountValue is sent in the DTO the handler must
    // not forward it to the package row — discount now lives on items only.
    await handler.execute({ packageId: PACKAGE_ID, nameEn: 'Updated' } as any);
    const data = tx.sessionPackage.update.mock.calls[0][0].data;
    expect(data.discountType).toBeUndefined();
    expect(data.discountValue).toBeUndefined();
  });

  it('includes items with constraints and targets on the final package update', async () => {
    await handler.execute({ packageId: PACKAGE_ID, nameAr: 'باقة محدّثة' } as any);
    const call = tx.sessionPackage.update.mock.calls[0][0];
    expect(call.include).toEqual({ items: { include: { constraints: { include: { targets: true } } } } });
  });

  describe('items replacement', () => {
    it('replaces items atomically (deleteMany + per-item create) with per-item discount + constraint rows when items are provided', async () => {
      await handler.execute({
        packageId: PACKAGE_ID,
        items: [
          {
            serviceId: SERVICE_ID,
            employeeId: EMPLOYEE_ID,
            durationOptionId: DURATION_OPTION_ID,
            paidQuantity: 8,
            freeQuantity: 2,
            sortOrder: 0,
          },
        ],
      } as any);

      expect(tx.sessionPackageItem.deleteMany).toHaveBeenCalledWith({ where: { packageId: PACKAGE_ID } });
      expect(tx.sessionPackageItem.create).toHaveBeenCalledTimes(1);
      const createArg = tx.sessionPackageItem.create.mock.calls[0][0];
      expect(createArg.data).toEqual({
        packageId: PACKAGE_ID,
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_OPTION_ID,
        unitPrice: null,
        label: null,
        paidQuantity: 8,
        freeQuantity: 2,
        discountType: null,
        discountValue: 0,
        sortOrder: 0,
        constraints: {
          create: [
            {
              dimension: PackageConstraintDimension.SERVICE,
              mode: PackageConstraintMode.INCLUDE,
              targets: { create: [{ targetId: SERVICE_ID }] },
            },
            {
              dimension: PackageConstraintDimension.PRACTITIONER,
              mode: PackageConstraintMode.INCLUDE,
              targets: { create: [{ targetId: EMPLOYEE_ID }] },
            },
            {
              dimension: PackageConstraintDimension.DURATION,
              mode: PackageConstraintMode.INCLUDE,
              targets: { create: [{ targetId: DURATION_OPTION_ID }] },
            },
          ],
        },
      });
    });

    it('persists per-item PERCENTAGE discount on item row during replacement', async () => {
      await handler.execute({
        packageId: PACKAGE_ID,
        items: [
          {
            serviceId: SERVICE_ID,
            employeeId: EMPLOYEE_ID,
            durationOptionId: DURATION_OPTION_ID,
            paidQuantity: 4,
            freeQuantity: 0,
            discountType: DiscountType.PERCENTAGE,
            discountValue: 20,
            sortOrder: 0,
          },
        ],
      } as any);

      const createData = tx.sessionPackageItem.create.mock.calls[0][0].data;
      expect(createData.discountType).toBe(DiscountType.PERCENTAGE);
      expect(createData.discountValue).toBe(20);
    });

    it('does not touch items when no items are provided', async () => {
      await handler.execute({ packageId: PACKAGE_ID, nameAr: 'باقة محدّثة' } as any);
      expect(tx.sessionPackageItem.deleteMany).not.toHaveBeenCalled();
      expect(tx.sessionPackageItem.create).not.toHaveBeenCalled();
    });

    it('rejects items with paidQuantity + freeQuantity = 0', async () => {
      await expect(
        handler.execute({
          packageId: PACKAGE_ID,
          items: [{ serviceId: SERVICE_ID, employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID, paidQuantity: 0, freeQuantity: 0 }],
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(tx.sessionPackageItem.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects items whose employee does not provide the service', async () => {
      prisma.employeeService.findMany.mockResolvedValue([]);
      await expect(
        handler.execute({
          packageId: PACKAGE_ID,
          items: [{ serviceId: SERVICE_ID, employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID, paidQuantity: 1, freeQuantity: 0 }],
        } as any),
      ).rejects.toThrow(/Employee does not provide/i);
    });

    it('rejects items whose duration option belongs to a different service', async () => {
      prisma.employeeService.findMany.mockResolvedValue([
        { employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID },
      ]);
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: DURATION_OPTION_ID, serviceId: 'different-service' },
      ]);
      await expect(
        handler.execute({
          packageId: PACKAGE_ID,
          items: [{ serviceId: SERVICE_ID, employeeId: EMPLOYEE_ID, durationOptionId: DURATION_OPTION_ID, paidQuantity: 1, freeQuantity: 0 }],
        } as any),
      ).rejects.toThrow(/Duration option not found/i);
    });
  });

  describe('per-item discount validation', () => {
    it('rejects a per-item PERCENTAGE discountValue > 100', async () => {
      await expect(
        handler.execute({
          packageId: PACKAGE_ID,
          items: [
            {
              serviceId: SERVICE_ID,
              employeeId: EMPLOYEE_ID,
              durationOptionId: DURATION_OPTION_ID,
              paidQuantity: 4,
              freeQuantity: 0,
              discountType: DiscountType.PERCENTAGE,
              discountValue: 150,
            },
          ],
        } as any),
      ).rejects.toThrow(/between 0 and 100/);
    });

    it('rejects a per-item FIXED discountValue that exceeds the item payable amount', async () => {
      // Item payable = 4 paid × 10_000 = 40_000 halalas.
      // discountValue is in integer halalas — 50_000 > 40_000 must be rejected.
      await expect(
        handler.execute({
          packageId: PACKAGE_ID,
          items: [
            {
              serviceId: SERVICE_ID,
              employeeId: EMPLOYEE_ID,
              durationOptionId: DURATION_OPTION_ID,
              paidQuantity: 4,
              freeQuantity: 0,
              discountType: DiscountType.FIXED,
              discountValue: 50_000,
            },
          ],
        } as any),
      ).rejects.toThrow(/must not exceed/i);
    });

    it('accepts a valid per-item PERCENTAGE discount when items are replaced', async () => {
      await handler.execute({
        packageId: PACKAGE_ID,
        items: [
          {
            serviceId: SERVICE_ID,
            employeeId: EMPLOYEE_ID,
            durationOptionId: DURATION_OPTION_ID,
            paidQuantity: 4,
            freeQuantity: 0,
            discountType: DiscountType.PERCENTAGE,
            discountValue: 25,
          },
        ],
      } as any);

      // Item must have been written with the per-item discount.
      const createData = tx.sessionPackageItem.create.mock.calls[0][0].data;
      expect(createData.discountType).toBe(DiscountType.PERCENTAGE);
      expect(createData.discountValue).toBe(25);
    });
  });

  describe('flexible items', () => {
    it('replaces items with a flexible item (SERVICE INCLUDE single + PRACTITIONER ANY + DURATION ANY) and creates its constraint rows', async () => {
      // Flexible items skip the single-specific employee/duration linkage checks —
      // only the SERVICE INCLUDE target needs to resolve via prisma.service.findMany.
      prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);

      await handler.execute({
        packageId: PACKAGE_ID,
        items: [
          {
            constraints: [
              { dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.INCLUDE, targetIds: [SERVICE_ID] },
              { dimension: PackageConstraintDimension.PRACTITIONER, mode: PackageConstraintMode.ANY },
              { dimension: PackageConstraintDimension.DURATION, mode: PackageConstraintMode.ANY },
            ],
            unitPrice: 15_000,
            paidQuantity: 3,
            freeQuantity: 0,
            sortOrder: 0,
          },
        ],
      } as any);

      expect(tx.sessionPackageItem.deleteMany).toHaveBeenCalledWith({ where: { packageId: PACKAGE_ID } });
      expect(tx.sessionPackageItem.create).toHaveBeenCalledTimes(1);
      const createData = tx.sessionPackageItem.create.mock.calls[0][0].data;

      // Flexible item: SERVICE is a single-target INCLUDE so serviceId is still
      // derived as a legacy ref, but PRACTITIONER/DURATION are ANY so those
      // single-specific refs stay null (item is not single-specific overall).
      expect(createData.serviceId).toBe(SERVICE_ID);
      expect(createData.employeeId).toBeNull();
      expect(createData.durationOptionId).toBeNull();
      expect(createData.unitPrice).toBe(15_000);
      expect(createData.paidQuantity).toBe(3);

      expect(createData.constraints.create).toEqual([
        {
          dimension: PackageConstraintDimension.SERVICE,
          mode: PackageConstraintMode.INCLUDE,
          targets: { create: [{ targetId: SERVICE_ID }] },
        },
        {
          dimension: PackageConstraintDimension.PRACTITIONER,
          mode: PackageConstraintMode.ANY,
          targets: { create: [] },
        },
        {
          dimension: PackageConstraintDimension.DURATION,
          mode: PackageConstraintMode.ANY,
          targets: { create: [] },
        },
      ]);
    });
  });
});
