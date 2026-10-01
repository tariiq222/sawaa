import { BadRequestException } from '@nestjs/common';
import { CreatePackageFamilyHandler } from './create-package-family/create-package-family.handler';
import { UpdatePackageFamilyHandler } from './update-package-family/update-package-family.handler';
import { ListPublicPackageFamiliesHandler } from './list-public-package-families/list-public-package-families.handler';
import { GetPublicPackageFamilyHandler } from './get-public-package-family/get-public-package-family.handler';
import { ArchivePackageFamilyHandler } from './archive-package-family/archive-package-family.handler';

const FAMILY_ID = '00000000-0000-4000-a000-000000000001';
const OTHER_FAMILY_ID = '00000000-0000-4000-a000-000000000002';
const OPTION_5_ID = '00000000-0000-4000-a000-000000000011';
const OPTION_9_ID = '00000000-0000-4000-a000-000000000012';
const SERVICE_ID = '00000000-0000-4000-a000-000000000021';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000022';
const DURATION_60_ID = '00000000-0000-4000-a000-000000000023';

function optionInput(sessionCount: number, id?: string) {
  return {
    ...(id ? { id } : {}),
    nameAr: `${sessionCount} جلسات`,
    nameEn: `${sessionCount} sessions`,
    isActive: true,
    isPublic: true,
    groups: [{
      key: `clinic-${sessionCount}`,
      label: 'Clinic',
      serviceId: SERVICE_ID,
      employeeId: EMPLOYEE_ID,
      sequenceMode: 'ORDERED' as const,
      dependsOnGroupKey: null,
      sessions: Array.from({ length: sessionCount }, (_, position) => ({
        key: `session-${position}`,
        position,
        durationOptionId: DURATION_60_ID,
        deliveryType: 'IN_PERSON' as const,
        unitPrice: 10_000,
      })),
    }],
    globalDiscount: { type: 'NONE' as const, value: 0 as const },
  };
}

function familyInput() {
  return {
    nameAr: 'باقة العائلة',
    nameEn: 'Family pack',
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    options: [optionInput(5), optionInput(9)],
  };
}

function txFixture() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    packageFamily: {
      create: jest.fn().mockResolvedValue({ id: FAMILY_ID }),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    sessionPackage: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: data.id ?? `option-${tx.sessionPackage.create.mock.calls.length}`,
        ...data,
      })),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    sessionPackageGroup: { createMany: jest.fn() },
    sessionPackageItem: { create: jest.fn() },
    service: { findMany: jest.fn().mockResolvedValue([{ id: SERVICE_ID, nameAr: 'Clinic', nameEn: 'Clinic', isHidden: false, category: { id: 'cat', isActive: true, bookingMode: 'SERVICES' } }]) },
    employee: { findMany: jest.fn().mockResolvedValue([{ id: EMPLOYEE_ID, name: 'Practitioner', nameAr: 'ممارس', nameEn: 'Practitioner' }]) },
    employeeService: { findMany: jest.fn().mockResolvedValue([{ id: 'link', employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID, isActive: true, disabledDeliveryTypes: [], useCustomPricing: false }]) },
    serviceDurationOption: { findMany: jest.fn().mockResolvedValue([{ id: DURATION_60_ID, serviceId: SERVICE_ID, employeeServiceId: null, deliveryType: 'IN_PERSON', durationMins: 60, price: 10_000, isActive: true }]) },
    serviceBookingConfig: { findMany: jest.fn().mockResolvedValue([{ serviceId: SERVICE_ID, deliveryType: 'IN_PERSON' }]) },
  };
  return tx;
}

function construct(Handler: unknown, args: unknown[]) {
  return new (Handler as new (...constructorArgs: unknown[]) => unknown)(...args);
}

const resolver = { resolve: jest.fn().mockResolvedValue({ durationMins: 60, price: 10_000 }) };

describe('package family management', () => {
  it('creates one catalog family containing independently priced 5 and 9 session options', async () => {
    const tx = txFixture();
    const rls = { withTransaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const handler = construct(CreatePackageFamilyHandler, [
      { $transaction: jest.fn() },
      rls,
      resolver,
      {},
      {},
    ]) as { execute(input: ReturnType<typeof familyInput>): Promise<unknown> };

    await handler.execute(familyInput());

    expect(rls.withTransaction).toHaveBeenCalledTimes(1);
    expect(tx.packageFamily.create).toHaveBeenCalledTimes(1);
    expect(tx.sessionPackage.create).toHaveBeenCalledTimes(2);
    expect(tx.sessionPackage.create.mock.calls.map(([call]) => call.data.familyId)).toEqual([
      FAMILY_ID,
      FAMILY_ID,
    ]);
    expect(tx.sessionPackageItem.create.mock.calls.length).toBe(14);
  });

  it('rolls back the family when the second option fails', async () => {
    const tx = txFixture();
    tx.sessionPackage.create
      .mockResolvedValueOnce({ id: OPTION_5_ID })
      .mockRejectedValueOnce(new Error('second option invalid'));
    const rollback = new Error('transaction rolled back');
    tx.packageFamily.findUnique.mockResolvedValue({ id: FAMILY_ID, options: [] });
    const rls = {
      withTransaction: jest.fn(async (callback: (client: typeof tx) => unknown) => {
        try {
          return await callback(tx);
        } catch {
          throw rollback;
        }
      }),
    };
    const handler = construct(CreatePackageFamilyHandler, [{}, rls, resolver, {}]) as {
      execute(input: ReturnType<typeof familyInput>): Promise<unknown>;
    };

    await expect(handler.execute(familyInput())).rejects.toBe(rollback);
    expect(tx.packageFamily.create).toHaveBeenCalledTimes(1);
    expect(tx.sessionPackage.create).toHaveBeenCalledTimes(2);
  });

  it('rejects moving an option that belongs to another family', async () => {
    const tx = txFixture();
    tx.sessionPackage.findUnique.mockResolvedValue({
      id: OPTION_5_ID,
      familyId: OTHER_FAMILY_ID,
      modelVersion: 'GROUPED_V2',
    });
    tx.packageFamily.findUnique.mockResolvedValue({ id: FAMILY_ID, options: [{ id: OPTION_5_ID, familyId: OTHER_FAMILY_ID, archivedAt: null }] });
    const handler = construct(UpdatePackageFamilyHandler, [
      {},
      { withTransaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) },
      {},
      {},
      {},
    ]) as { execute(input: unknown): Promise<unknown> };

    await expect(handler.execute({
      familyId: FAMILY_ID,
      ...familyInput(),
      options: [optionInput(5, OPTION_5_ID)],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.sessionPackage.update).not.toHaveBeenCalled();
  });

  it('archives the family and options without deleting purchase-bearing rows', async () => {
    const tx = txFixture();
    tx.packageFamily.findUnique.mockResolvedValue({ id: FAMILY_ID });
    const rls = { withTransaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    const handler = construct(ArchivePackageFamilyHandler, [rls, undefined]) as { execute(input: { familyId: string }): Promise<void> };

    await handler.execute({ familyId: FAMILY_ID });

    expect(tx.sessionPackage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { familyId: FAMILY_ID },
      data: expect.objectContaining({ isActive: false, isPublic: false, archivedAt: expect.any(Date) }),
    }));
    expect(tx.packageFamily.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: FAMILY_ID },
      data: expect.objectContaining({ isActive: false, isPublic: false, archivedAt: expect.any(Date) }),
    }));
  });
});

describe('public package family catalog', () => {
  it('returns only active, public, unarchived families with at least one sellable option', async () => {
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0 }) },
      packageFamily: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: FAMILY_ID,
            nameAr: 'Visible family',
            isActive: true,
            isPublic: true,
            archivedAt: null,
            options: [
              { id: OPTION_5_ID, isActive: true, isPublic: true, archivedAt: null, groups: [], items: [] },
              { id: OPTION_9_ID, isActive: false, isPublic: true, archivedAt: null, groups: [], items: [] },
            ],
          },
          {
            id: OTHER_FAMILY_ID,
            nameAr: 'Hidden family',
            isActive: true,
            isPublic: true,
            archivedAt: null,
            options: [{ id: 'hidden-option', isActive: false, isPublic: false, archivedAt: null, groups: [], items: [] }],
          },
        ]),
      },
      sessionPackage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const handler = construct(ListPublicPackageFamiliesHandler, [prisma, {}, {}, {}]) as {
      execute(): Promise<Array<{ id: string; vatRate: number; options: Array<{ id: string }> }>>;
    };

    const result = await handler.execute();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(FAMILY_ID);
    expect(result[0].vatRate).toBe(0);
    expect(result[0].options.map((option) => option.id)).toEqual([OPTION_5_ID]);
  });
});

describe('public package family detail projection', () => {
  it('normalizes grouped persisted rows into editor groups, sessions, and discount', async () => {
    const option = {
      id: OPTION_5_ID,
      familyId: FAMILY_ID,
      nameAr: '5 جلسات',
      isActive: true,
      isPublic: true,
      archivedAt: null,
      modelVersion: 'GROUPED_V2',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      items: [{
        id: 'item-1', groupId: 'group-1', sessionPosition: 0, durationOptionId: DURATION_60_ID,
        unitPrice: 10_000,
        constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'IN_PERSON' }] }],
      }],
      groups: [{ id: 'group-1', key: 'clinic', label: 'Clinic', serviceId: SERVICE_ID, employeeId: EMPLOYEE_ID, sequenceMode: 'ORDERED', dependsOnGroupId: null, sortOrder: 0, items: [{
        id: 'item-1', groupId: 'group-1', sessionPosition: 0, durationOptionId: DURATION_60_ID,
        unitPrice: 10_000,
        constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'IN_PERSON' }] }],
      }] }],
    };
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0 }) },
      packageFamily: { findFirst: jest.fn().mockResolvedValue({ id: FAMILY_ID, nameAr: 'Family', isActive: true, isPublic: true, archivedAt: null, options: [option] }) },
      sessionPackage: { findFirst: jest.fn() },
      service: { findMany: jest.fn().mockResolvedValue([{ id: SERVICE_ID, nameAr: 'العيادة', nameEn: 'Clinic', isHidden: false, category: null }]) },
      employee: { findMany: jest.fn().mockResolvedValue([{ id: EMPLOYEE_ID, name: 'Practitioner', nameAr: 'المعالج', nameEn: 'Counselor' }]) },
      serviceDurationOption: { findMany: jest.fn().mockResolvedValue([{ id: DURATION_60_ID, durationMins: 60, deliveryType: 'IN_PERSON' }]) },
    };
    const pricing = { compute: jest.fn().mockResolvedValue({ subtotal: 10_000, discountAmount: 0, finalPrice: 10_000, fullValue: 10_000, freeValue: 0, itemUnitPrices: [], lines: [] }) };
    const handler = construct(GetPublicPackageFamilyHandler, [prisma, pricing, {}, {}]) as { execute(input: { familyId: string }): Promise<any> };

    const result = await handler.execute({ familyId: FAMILY_ID });

    expect(result.options[0]).toEqual(expect.objectContaining({
      globalDiscount: { type: 'PERCENTAGE', value: 10 },
      groups: [expect.objectContaining({ sessions: [expect.objectContaining({ durationOptionId: DURATION_60_ID, deliveryType: 'IN_PERSON' })] })],
      displayGroups: [{
        key: 'clinic', label: 'Clinic', serviceNameAr: 'العيادة', serviceNameEn: 'Clinic', employeeName: 'المعالج',
        sessions: [{ position: 0, durationMins: 60, deliveryType: 'IN_PERSON' }],
      }],
    }));
  });

  it('projects a standalone package detail with the same family-shaped response', async () => {
    const prisma = {
      organizationSettings: { findFirst: jest.fn().mockResolvedValue({ vatRate: 0 }) },
      packageFamily: { findFirst: jest.fn().mockResolvedValue(null) },
      sessionPackage: {
        findFirst: jest.fn().mockResolvedValue({
          id: OPTION_5_ID,
          familyId: null,
          nameAr: 'Legacy',
          nameEn: null,
          descriptionAr: null,
          descriptionEn: null,
          imageUrl: null,
          isActive: true,
          isPublic: true,
          sortOrder: 0,
          archivedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          modelVersion: 'LEGACY',
          items: [],
          groups: [],
        }),
      },
    };
    const handler = construct(GetPublicPackageFamilyHandler, [prisma, {}, {}, {}]) as { execute(input: { familyId: string }): Promise<any> };

    const result = await handler.execute({ familyId: OPTION_5_ID });

    expect(result).toEqual(expect.objectContaining({ id: OPTION_5_ID, isStandalone: true }));
    expect(result.options).toEqual([expect.objectContaining({ id: OPTION_5_ID, familyId: null, groups: [], globalDiscount: { type: 'NONE', value: 0 } })]);
  });
});
