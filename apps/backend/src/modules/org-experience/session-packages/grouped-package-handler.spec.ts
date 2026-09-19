import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateSessionPackageDto } from './create-session-package/create-session-package.dto';
import { UpdateSessionPackageDto } from './update-session-package/update-session-package.dto';
import { CreateSessionPackageHandler } from './create-session-package/create-session-package.handler';
import { UpdateSessionPackageHandler } from './update-session-package/update-session-package.handler';

const serviceId = '00000000-0000-4000-a000-000000000001';
const employeeId = '00000000-0000-4000-a000-000000000002';
const durationId = '00000000-0000-4000-a000-000000000003';

const groupPayload = {
  key: 'first', serviceId, employeeId, sequenceMode: 'ORDERED', dependsOnGroupKey: null,
  sessions: [{ key: 'session-1', position: 0, durationOptionId: durationId, deliveryType: 'IN_PERSON', unitPrice: 25000 }],
};

async function transform<T>(metatype: new () => T, value: object): Promise<T> {
  return new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }).transform(value, {
    type: 'body', metatype,
  }) as Promise<T>;
}

function offeringDb() {
  return {
    service: { findMany: jest.fn().mockResolvedValue([{ id: serviceId, name: 'Service', nameAr: 'الخدمة', nameEn: 'Service', isHidden: false, category: { id: 'cat-1', isActive: true, bookingMode: 'SERVICES' } }]) },
    employee: { findMany: jest.fn().mockResolvedValue([{ id: employeeId, name: 'Employee', nameAr: 'المعالج', nameEn: 'Employee' }]) },
    employeeService: { findMany: jest.fn().mockResolvedValue([{ id: 'link-1', employeeId, serviceId, isActive: true, disabledDeliveryTypes: [], useCustomPricing: false }]) },
    serviceDurationOption: { findMany: jest.fn().mockResolvedValue([{ id: durationId, serviceId, employeeServiceId: null, deliveryType: 'IN_PERSON', durationMins: 60, price: 30000, isActive: true }]) },
    serviceBookingConfig: { findMany: jest.fn().mockResolvedValue([{ serviceId, deliveryType: 'IN_PERSON' }]) },
  };
}

function createTx() {
  return {
    sessionPackage: {
      create: jest.fn().mockResolvedValue({ id: 'pkg-1' }),
      findUnique: jest.fn().mockResolvedValue({ id: 'pkg-1', modelVersion: 'GROUPED_V2', groups: [], items: [] }),
    },
    sessionPackageGroup: { createMany: jest.fn() },
    sessionPackageItem: { create: jest.fn() },
  };
}

describe('grouped package HTTP DTO boundary', () => {
  it('accepts a transformed V2 create without legacy fields', async () => {
    const dto = await transform(CreateSessionPackageDto, {
      nameAr: 'باقة', modelVersion: 'GROUPED_V2', groups: [groupPayload], globalDiscount: { type: 'NONE', value: 0 },
    });
    const db = offeringDb();
    const tx = createTx();
    const handler = new CreateSessionPackageHandler(
      db as never,
      { withTransaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never,
      {} as never,
      { invalidatePrefix: jest.fn() } as never,
      { resolve: jest.fn().mockResolvedValue({ price: 30000, durationMins: 60 }) } as never,
    );
    await expect(handler.execute(dto)).resolves.toEqual(expect.objectContaining({ id: 'pkg-1' }));
    expect(tx.sessionPackage.create).toHaveBeenCalled();
  });

  it('accepts a transformed V2 metadata update without legacy fields', async () => {
    const dto = await transform(UpdateSessionPackageDto, { nameAr: 'باقة جديدة' });
    const db = offeringDb();
    const existing = {
      id: 'pkg-1', modelVersion: 'GROUPED_V2', discountType: 'PERCENTAGE', discountValue: 0,
      groups: [{ id: 'group-1', key: 'first', label: null, serviceId, employeeId, sequenceMode: 'ORDERED', dependsOnGroupId: null, sortOrder: 0,
        items: [{ id: 'item-1', groupId: 'group-1', sessionPosition: 0, durationOptionId: durationId, unitPrice: 25000,
          constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'IN_PERSON' }] }] }] }],
      items: [{ id: 'item-1', groupId: 'group-1', sessionPosition: 0, durationOptionId: durationId, unitPrice: 25000,
        constraints: [{ dimension: 'DELIVERY_TYPE', mode: 'INCLUDE', targets: [{ targetId: 'IN_PERSON' }] }] }],
    };
    const tx = {
      sessionPackageItem: { deleteMany: jest.fn(), create: jest.fn() },
      sessionPackageGroup: { updateMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      sessionPackage: { update: jest.fn().mockResolvedValue(existing) },
    };
    const handler = new UpdateSessionPackageHandler(
      { ...db, sessionPackage: { findFirst: jest.fn().mockResolvedValue(existing) } } as never,
      { withTransaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never,
      {} as never,
      { invalidatePrefix: jest.fn() } as never,
      { resolve: jest.fn() } as never,
    );
    await expect(handler.execute({ ...dto, packageId: 'pkg-1' })).resolves.toEqual(existing);
    expect(tx.sessionPackage.update).toHaveBeenCalled();
    expect(tx.sessionPackageGroup.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a group replacement when a retained fixed discount exceeds the new subtotal', async () => {
    const dto = await transform(UpdateSessionPackageDto, { modelVersion: 'GROUPED_V2', groups: [groupPayload] });
    const db = offeringDb();
    const existing = {
      id: 'pkg-1', modelVersion: 'GROUPED_V2', discountType: 'FIXED', discountValue: 50000,
      groups: [{ id: 'group-1', key: 'first', label: null, serviceId, employeeId, sequenceMode: 'ORDERED', dependsOnGroupId: null, sortOrder: 0, items: [] }], items: [],
    };
    const tx = {
      sessionPackageItem: { deleteMany: jest.fn(), create: jest.fn() },
      sessionPackageGroup: { updateMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      sessionPackage: { update: jest.fn() },
    };
    const handler = new UpdateSessionPackageHandler(
      { ...db, sessionPackage: { findFirst: jest.fn().mockResolvedValue(existing) } } as never,
      { withTransaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never,
      {} as never, { invalidatePrefix: jest.fn() } as never,
      { resolve: jest.fn().mockResolvedValue({ price: 30000, durationMins: 60 }) } as never,
    );
    await expect(handler.execute({ ...dto, packageId: 'pkg-1' })).rejects.toThrow('Fixed discount cannot exceed the session price subtotal');
    expect(tx.sessionPackage.update).not.toHaveBeenCalled();
  });

  it.each(['groups', 'globalDiscount'])('rejects explicit null %s before writes', async (field) => {
    const existing = { id: 'pkg-1', modelVersion: 'GROUPED_V2', groups: [], items: [] };
    const withTransaction = jest.fn();
    const handler = new UpdateSessionPackageHandler(
      { sessionPackage: { findFirst: jest.fn().mockResolvedValue(existing) } } as never,
      { withTransaction } as never, {} as never,
      { invalidatePrefix: jest.fn() } as never, {} as never,
    );
    await expect(handler.execute({ packageId: 'pkg-1', [field]: null } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it('rejects V2 replacement money overflow before transaction writes', async () => {
    const dto = await transform(UpdateSessionPackageDto, {
      modelVersion: 'GROUPED_V2', groups: [{ ...groupPayload, sessions: [{ ...groupPayload.sessions[0], unitPrice: 10_000_000_000 }] }],
    });
    const db = offeringDb();
    const existing = { id: 'pkg-1', modelVersion: 'GROUPED_V2', discountType: 'PERCENTAGE', discountValue: 0, groups: [], items: [] };
    const tx = {
      sessionPackageItem: { deleteMany: jest.fn(), create: jest.fn() },
      sessionPackageGroup: { updateMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      sessionPackage: { update: jest.fn() },
    };
    const handler = new UpdateSessionPackageHandler(
      { ...db, sessionPackage: { findFirst: jest.fn().mockResolvedValue(existing) } } as never,
      { withTransaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never,
      {} as never, { invalidatePrefix: jest.fn() } as never,
      { resolve: jest.fn().mockResolvedValue({ price: 30000, durationMins: 60 }) } as never,
    );
    await expect(handler.execute({ ...dto, packageId: 'pkg-1' })).rejects.toThrow('Decimal(12,2) storage limit');
    expect(tx.sessionPackageGroup.createMany).not.toHaveBeenCalled();
  });

  it('rejects V2 fields on a legacy create instead of silently dropping them', async () => {
    const dto = await transform(CreateSessionPackageDto, {
      nameAr: 'باقة', groups: [groupPayload], globalDiscount: { type: 'NONE', value: 0 },
      items: [{ paidQuantity: 1, serviceId, employeeId, durationOptionId: durationId }],
    });
    const handler = new CreateSessionPackageHandler({} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(handler.execute(dto)).rejects.toThrow('LEGACY packages cannot include GROUPED_V2');
  });
});
