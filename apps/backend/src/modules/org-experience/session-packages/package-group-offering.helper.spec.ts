import { BadRequestException } from '@nestjs/common';
import { resolvePackageGroupOfferings, validateGroupedPackageStorageBounds } from './package-group-offering.helper';

const SERVICE_ID = '00000000-0000-4000-a000-000000000001';
const EMPLOYEE_ID = '00000000-0000-4000-a000-000000000002';
const DURATION_ID = '00000000-0000-4000-a000-000000000003';

function dbFixture() {
  return {
    service: { findMany: jest.fn().mockResolvedValue([{ id: SERVICE_ID, nameAr: 'الخدمة', nameEn: 'Service', isHidden: false, category: { id: 'cat-1', isActive: true, bookingMode: 'SERVICES' } }]) },
    employee: { findMany: jest.fn().mockResolvedValue([{ id: EMPLOYEE_ID, name: 'Employee', nameAr: 'المعالج', nameEn: 'Employee' }]) },
    employeeService: { findMany: jest.fn().mockResolvedValue([{ id: 'link-1', employeeId: EMPLOYEE_ID, serviceId: SERVICE_ID, isActive: true, disabledDeliveryTypes: [], useCustomPricing: false }]) },
    serviceDurationOption: { findMany: jest.fn().mockResolvedValue([{ id: DURATION_ID, serviceId: SERVICE_ID, employeeServiceId: null, deliveryType: 'IN_PERSON', durationMins: 60, price: 30000, isActive: true }]) },
    serviceBookingConfig: { findMany: jest.fn().mockResolvedValue([{ serviceId: SERVICE_ID, deliveryType: 'IN_PERSON' }]) },
  };
}

const groups = [{
  key: 'first', serviceId: SERVICE_ID, employeeId: EMPLOYEE_ID, sequenceMode: 'ORDERED' as const,
  dependsOnGroupKey: null,
  sessions: [{ key: 'session-1', position: 0, durationOptionId: DURATION_ID, deliveryType: 'IN_PERSON' as const, unitPrice: 25000 }],
}];

describe('resolvePackageGroupOfferings', () => {
  it('resolves names, list price, duration, and the package override price', async () => {
    const db = dbFixture();
    const resolver = { resolve: jest.fn().mockResolvedValue({ price: 28000, durationMins: 50 }) };
    await expect(resolvePackageGroupOfferings(db as never, groups, resolver as never)).resolves.toEqual([
      expect.objectContaining({
        key: 'first',
        sessions: [expect.objectContaining({ durationMins: 50, listPrice: 28000, effectivePrice: 28000, serviceName: 'الخدمة', employeeName: 'المعالج' })],
      }),
    ]);
    expect(db.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ name: true }),
    }));
    expect(resolver.resolve).toHaveBeenCalledWith(expect.objectContaining({ serviceId: SERVICE_ID, employeeServiceId: 'link-1', durationOptionId: DURATION_ID, deliveryType: 'IN_PERSON' }));
  });

  it('rejects an unknown explicit duration before resolving price', async () => {
    const db = dbFixture();
    db.serviceDurationOption.findMany.mockResolvedValue([]);
    const resolver = { resolve: jest.fn() };
    await expect(resolvePackageGroupOfferings(db as never, groups, resolver as never)).rejects.toThrow(BadRequestException);
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('rejects prices whose Decimal(12,2) integer-halalas value would overflow', () => {
    expect(() => validateGroupedPackageStorageBounds([9_000_000_000, 1_000_000_000], { type: 'NONE', value: 0 })).toThrow(BadRequestException);
    expect(() => validateGroupedPackageStorageBounds([10_000_000_000], { type: 'NONE', value: 0 })).toThrow(BadRequestException);
  });

  it('accepts two-decimal percentage discounts but rejects values that would round in Decimal(12,2)', () => {
    for (const value of [0.07, 0.29, 2.55]) {
      expect(() => validateGroupedPackageStorageBounds([30_000], { type: 'PERCENTAGE', value })).not.toThrow();
    }
    expect(() => validateGroupedPackageStorageBounds([30_000], { type: 'PERCENTAGE', value: 12.34 })).not.toThrow();
    expect(() => validateGroupedPackageStorageBounds([30_000], { type: 'PERCENTAGE', value: 12.345 })).toThrow(
      'Percentage package discount must have at most two decimal places',
    );
  });

  it('rejects hidden services outside DIRECT categories', async () => {
    const db = dbFixture();
    db.service.findMany.mockResolvedValue([{ id: SERVICE_ID, nameAr: 'مخفي', nameEn: 'Hidden', isHidden: true, category: { id: 'cat-1', isActive: true, bookingMode: 'SERVICES' } }]);
    await expect(resolvePackageGroupOfferings(db as never, groups, { resolve: jest.fn() } as never)).rejects.toThrow('Hidden services must belong to a DIRECT category');
  });

  it('accepts a hidden service in a DIRECT category', async () => {
    const db = dbFixture();
    db.service.findMany.mockResolvedValue([{ id: SERVICE_ID, nameAr: 'مخفي', nameEn: 'Hidden', isHidden: true, category: { id: 'cat-1', nameAr: 'العيادة النفسية', isActive: true, bookingMode: 'DIRECT' } }]);
    const resolved = await resolvePackageGroupOfferings(db as never, groups, { resolve: jest.fn().mockResolvedValue({ price: 30000, durationMins: 60 }) } as never);
    expect(resolved[0].sessions[0].serviceName).toBe('العيادة النفسية');
  });
});
