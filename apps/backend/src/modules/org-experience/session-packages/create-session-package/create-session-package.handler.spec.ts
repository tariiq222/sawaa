import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { DiscountType, PackageConstraintDimension, PackageConstraintMode } from '@prisma/client';
import { CreateSessionPackageHandler } from './create-session-package.handler';
import { ComputePackagePriceService } from '../../compute-package-price.service';
import { CacheService } from '../../../../infrastructure/cache';

const cacheProvider = { provide: CacheService, useValue: { invalidatePrefix: jest.fn() } };

/**
 * Build a per-test Prisma stub. Each method the handler (via
 * `validatePackageItems` and `ComputePackagePriceService`) may call is a
 * jest.fn() so individual tests can script query responses. The transaction
 * wrapper hands its callback a `tx` proxy whose methods mirror the same
 * shape as the Prisma top-level — we pass `tx` through and mock `tx` too.
 */
function buildPrisma() {
  const service = { findMany: jest.fn() };
  const employee = { findMany: jest.fn() };
  const employeeService = { findMany: jest.fn() };
  const employeeServiceOption = { findMany: jest.fn().mockResolvedValue([]) };
  const serviceDurationOption = { findMany: jest.fn() };
  const sessionPackageCreate = jest.fn();
  const tx = {
    sessionPackage: { create: sessionPackageCreate },
  };
  return {
    service,
    employee,
    employeeService,
    employeeServiceOption,
    serviceDurationOption,
    sessionPackage: { create: sessionPackageCreate },
    _tx: tx,
  };
}

const SERVICE_ID = '00000000-0000-4000-a000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000002';
const DURATION_OPTION_ID = '00000000-0000-4000-a000-000000000003';

const validItem = () => ({
  serviceId: SERVICE_ID,
  employeeId: EMPLOYEE_ID,
  durationOptionId: DURATION_OPTION_ID,
  paidQuantity: 4,
  freeQuantity: 0,
});

// Package-level discountType/discountValue are deprecated — the DTO still accepts
// them but the handler ignores them. Tests pass per-item discounts on the item.
const validDto = () => ({
  nameAr: 'باقة العائلة',
  items: [validItem()],
});

describe('CreateSessionPackageHandler', () => {
  let handler: CreateSessionPackageHandler;
  let prisma: ReturnType<typeof buildPrisma>;
  let tx: ReturnType<typeof buildPrisma>['_tx'];

  beforeEach(async () => {
    prisma = buildPrisma();
    tx = prisma._tx;

    const module = await Test.createTestingModule({
      providers: [
        CreateSessionPackageHandler,
        ComputePackagePriceService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) },
        },
        cacheProvider,
      ],
    }).compile();

    handler = module.get(CreateSessionPackageHandler);
  });

  /**
   * Default success wiring for a single legacy-triple (single-specific) item:
   *  - `prisma.service.findMany` / `employee.findMany` / `serviceDurationOption.findMany`
   *    resolve the existence checks that `validatePackageItems` bulk-queries.
   *  - `prisma.employeeService.findMany` resolves the employee-offers-service link
   *    check (both the constraint-helper's link check and the pricing service's
   *    unit-price resolution reuse this same mock).
   *  - `prisma.employeeServiceOption.findMany` resolves no price override, so the
   *    pricing service falls back to `ServiceDurationOption.price`.
   *  - The package create resolves with a fake created row including items.
   */
  function mockHappyPath({ basePrice = 10_000 }: { basePrice?: number } = {}) {
    prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);
    prisma.employee.findMany.mockResolvedValue([{ id: EMPLOYEE_ID }]);
    prisma.serviceDurationOption.findMany.mockResolvedValue([
      { id: DURATION_OPTION_ID, serviceId: SERVICE_ID, price: { toString: () => String(basePrice) } },
    ]);
    prisma.employeeService.findMany.mockResolvedValue([
      { id: 'es-1', employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID },
    ]);
    prisma.employeeServiceOption.findMany.mockResolvedValue([]);
    tx.sessionPackage.create.mockResolvedValue({
      id: 'pkg-1',
      nameAr: 'باقة العائلة',
      items: [],
    });
  }

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  describe('happy path', () => {
    it('stores a neutral discountType=PERCENTAGE/discountValue=0 on the package row and per-item fields + constraints on items.create', async () => {
      mockHappyPath();
      // Item has no per-item discount.
      await handler.execute(validDto() as any);

      expect(tx.sessionPackage.create).toHaveBeenCalledTimes(1);
      const call = tx.sessionPackage.create.mock.calls[0][0];
      // Package-level discount is always stored as a neutral PERCENTAGE/0 sentinel.
      expect(call.data.discountType).toBe(DiscountType.PERCENTAGE);
      expect(call.data.discountValue).toBe(0);
      expect(call.data.items.create).toHaveLength(1);
      // Per-item fields must be present (null/0 for items with no discount), and the
      // legacy triple is synthesized into 3 INCLUDE constraints (SERVICE/PRACTITIONER/DURATION).
      expect(call.data.items.create[0]).toEqual({
        serviceId: SERVICE_ID,
        employeeId: EMPLOYEE_ID,
        durationOptionId: DURATION_OPTION_ID,
        unitPrice: null,
        label: null,
        paidQuantity: 4,
        freeQuantity: 0,
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
      expect(call.include).toEqual({ items: { include: { constraints: { include: { targets: true } } } } });
    });

    it('returns the created package including items', async () => {
      mockHappyPath();
      const result = await handler.execute(validDto() as any);
      expect(result.id).toBe('pkg-1');
    });

    it('applies default isActive=true and isPublic=false when omitted', async () => {
      mockHappyPath();
      await handler.execute(validDto() as any);
      const data = tx.sessionPackage.create.mock.calls[0][0].data;
      expect(data.isActive).toBe(true);
      expect(data.isPublic).toBe(false);
      expect(data.sortOrder).toBe(0);
    });

    it('preserves user-supplied isActive/isPublic/sortOrder', async () => {
      mockHappyPath();
      await handler.execute({ ...validDto(), isActive: false, isPublic: true, sortOrder: 7 } as any);
      const data = tx.sessionPackage.create.mock.calls[0][0].data;
      expect(data.isActive).toBe(false);
      expect(data.isPublic).toBe(true);
      expect(data.sortOrder).toBe(7);
    });

    it('persists a per-item PERCENTAGE discount as-is on the item row', async () => {
      mockHappyPath({ basePrice: 10_000 }); // 4 paid × 10_000 = 40_000 payable
      await handler.execute({
        ...validDto(),
        items: [{ ...validItem(), discountType: DiscountType.PERCENTAGE, discountValue: 10 }],
      } as any);
      const itemData = tx.sessionPackage.create.mock.calls[0][0].data.items.create[0];
      expect(itemData.discountType).toBe(DiscountType.PERCENTAGE);
      expect(itemData.discountValue).toBe(10);
    });

    it('persists a per-item FIXED discount (value already in integer halalas) on the item row', async () => {
      mockHappyPath({ basePrice: 10_000 }); // 4 paid × 10_000 = 40_000 payable
      // discountValue is always in integer halalas — send 5_000 halalas (50 SAR).
      await handler.execute({
        ...validDto(),
        items: [{ ...validItem(), discountType: DiscountType.FIXED, discountValue: 5_000 }],
      } as any);
      const itemData = tx.sessionPackage.create.mock.calls[0][0].data.items.create[0];
      expect(itemData.discountType).toBe(DiscountType.FIXED);
      expect(itemData.discountValue).toBe(5_000);
    });

    it('runs inside an RLS-scoped transaction', async () => {
      mockHappyPath();
      const rls = { withTransaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
      const module = await Test.createTestingModule({
        providers: [
          CreateSessionPackageHandler,
          ComputePackagePriceService,
          { provide: PrismaService, useValue: prisma },
          { provide: RlsTransactionService, useValue: rls },
          cacheProvider,
        ],
      }).compile();
      const h = module.get(CreateSessionPackageHandler);
      await h.execute(validDto() as any);
      expect(rls.withTransaction).toHaveBeenCalledTimes(1);
    });

    it('creates a flexible item (SERVICE=INCLUDE, PRACTITIONER=ANY, DURATION=ANY, fixed unitPrice) without an employee-service link', async () => {
      // Flexible item needs the service to exist, but no employee/duration targets
      // (ANY constraints contribute no targets), so employeeService.findMany must
      // NOT be required to resolve a link for this item.
      prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.serviceDurationOption.findMany.mockResolvedValue([]);
      prisma.employeeService.findMany.mockResolvedValue([]);
      prisma.employeeServiceOption.findMany.mockResolvedValue([]);
      tx.sessionPackage.create.mockResolvedValue({ id: 'pkg-flex-1', items: [] });

      const flexItem = {
        constraints: [
          { dimension: PackageConstraintDimension.SERVICE, mode: PackageConstraintMode.INCLUDE, targetIds: [SERVICE_ID] },
          { dimension: PackageConstraintDimension.PRACTITIONER, mode: PackageConstraintMode.ANY },
          { dimension: PackageConstraintDimension.DURATION, mode: PackageConstraintMode.ANY },
        ],
        unitPrice: 20_000,
        paidQuantity: 4,
        freeQuantity: 0,
      };

      const result = await handler.execute({ ...validDto(), items: [flexItem] } as any);

      expect(result.id).toBe('pkg-flex-1');
      // The employee-service link check only runs for single-specific items —
      // a flexible item (ANY practitioner/duration) never needs a link.
      expect(prisma.employeeService.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: expect.anything() }) }),
      );

      const call = tx.sessionPackage.create.mock.calls[0][0];
      const itemData = call.data.items.create[0];
      // SERVICE=INCLUDE with a single target still derives a legacy `serviceId` ref
      // (singleInclude), but PRACTITIONER/DURATION=ANY keep those refs null — the
      // item is not single-specific, so no employee-service link is required.
      expect(itemData.serviceId).toBe(SERVICE_ID);
      expect(itemData.employeeId).toBeNull();
      expect(itemData.durationOptionId).toBeNull();
      expect(itemData.unitPrice).toBe(20_000);
      expect(itemData.constraints.create).toEqual([
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

  describe('item validation', () => {
    it('rejects an item with paidQuantity + freeQuantity = 0', async () => {
      mockHappyPath();
      await expect(
        handler.execute({
          ...validDto(),
          items: [{ ...validItem(), paidQuantity: 0, freeQuantity: 0 }],
        } as any),
      ).rejects.toThrow(BadRequestException);

      expect(tx.sessionPackage.create).not.toHaveBeenCalled();
    });

    it('rejects an item whose employee does not provide the service', async () => {
      prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);
      prisma.employee.findMany.mockResolvedValue([{ id: EMPLOYEE_ID }]);
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: DURATION_OPTION_ID, serviceId: SERVICE_ID },
      ]);
      prisma.employeeService.findMany.mockResolvedValue([]); // no link

      await expect(handler.execute(validDto() as any)).rejects.toThrow(/Employee does not provide/i);
      expect(tx.sessionPackage.create).not.toHaveBeenCalled();
    });

    it('rejects an item whose durationOptionId belongs to a different service', async () => {
      prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);
      prisma.employee.findMany.mockResolvedValue([{ id: EMPLOYEE_ID }]);
      prisma.employeeService.findMany.mockResolvedValue([
        { employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID },
      ]);
      // duration option exists but for a different service
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: DURATION_OPTION_ID, serviceId: 'different-service-id' },
      ]);

      await expect(handler.execute(validDto() as any)).rejects.toThrow(/Duration option not found/i);
      expect(tx.sessionPackage.create).not.toHaveBeenCalled();
    });
  });

  describe('per-item discount validation', () => {
    it('rejects a per-item PERCENTAGE discountValue > 100', async () => {
      mockHappyPath();

      await expect(
        handler.execute({
          ...validDto(),
          items: [{ ...validItem(), discountType: DiscountType.PERCENTAGE, discountValue: 150 }],
        } as any),
      ).rejects.toThrow(/between 0 and 100/);
    });

    it('rejects a per-item PERCENTAGE discountValue < 0', async () => {
      mockHappyPath();

      await expect(
        handler.execute({
          ...validDto(),
          items: [{ ...validItem(), discountType: DiscountType.PERCENTAGE, discountValue: -5 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a per-item FIXED discount that exceeds the item payable amount', async () => {
      // Item payable = 4 paid × 10_000 = 40_000 halalas.
      // discountValue is in integer halalas — send 50_000 > 40_000 to trigger rejection.
      mockHappyPath({ basePrice: 10_000 });
      await expect(
        handler.execute({
          ...validDto(),
          items: [{ ...validItem(), discountType: DiscountType.FIXED, discountValue: 50_000 }],
        } as any),
      ).rejects.toThrow(/must not exceed/i);
    });
  });

  describe('multi-item payload', () => {
    it('passes all items to items.create in input order', async () => {
      prisma.service.findMany.mockResolvedValue([{ id: SERVICE_ID }]);
      prisma.employee.findMany.mockResolvedValue([{ id: EMPLOYEE_ID }]);
      prisma.employeeService.findMany.mockResolvedValue([
        { id: 'es-1', employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID },
      ]);
      prisma.employeeServiceOption.findMany.mockResolvedValue([]);
      prisma.serviceDurationOption.findMany.mockResolvedValue([
        { id: DURATION_OPTION_ID, serviceId: SERVICE_ID, price: { toString: () => '5000' } },
        { id: 'dur-2', serviceId: SERVICE_ID, price: { toString: () => '5000' } },
      ]);
      tx.sessionPackage.create.mockResolvedValue({ id: 'pkg-1' });

      await handler.execute({
        ...validDto(),
        items: [
          { ...validItem(), durationOptionId: DURATION_OPTION_ID, paidQuantity: 2, sortOrder: 5 },
          { ...validItem(), durationOptionId: 'dur-2', paidQuantity: 1, sortOrder: 6 },
        ],
      } as any);

      const call = tx.sessionPackage.create.mock.calls[0][0];
      expect(call.data.items.create).toHaveLength(2);
      expect(call.data.items.create[0].sortOrder).toBe(5);
      expect(call.data.items.create[1].sortOrder).toBe(6);
    });

    it('falls back to index when sortOrder is omitted on an item', async () => {
      mockHappyPath();
      await handler.execute({
        ...validDto(),
        items: [
          { ...validItem(), paidQuantity: 1, sortOrder: undefined },
          { ...validItem(), paidQuantity: 2, sortOrder: undefined },
        ],
      } as any);
      const data = tx.sessionPackage.create.mock.calls[0][0].data.items.create;
      expect(data[0].sortOrder).toBe(0);
      expect(data[1].sortOrder).toBe(1);
    });
  });
});
