import { describe, expect, it } from 'vitest';
import { getCategoryBookingServices, getDirectClinicService, selectBookableClinicEntries } from './bookable-clinics';

const direct = { id: 'direct', kind: 'CLINIC', bookingMode: 'DIRECT', sortOrder: 2, nameAr: 'عيادة' };
const group = { id: 'group', kind: 'SERVICE_GROUP', bookingMode: 'SERVICES', sortOrder: 1 };
const internal = { id: 'internal', categoryId: 'direct', isHidden: true, isActive: true };
const visible = { id: 'visible', categoryId: 'direct', isHidden: false, isActive: true };

describe('catalog booking selectors', () => {
  it('selects a direct clinic without counting its internal service or requiring a department', () => {
    const catalog = { departments: [], categories: [direct], services: [visible, internal] };
    const employees = [{ id: 'e', isBookable: true, serviceIds: ['internal'] }];
    const before = JSON.stringify(catalog);
    expect(selectBookableClinicEntries(catalog, employees)[0]).toMatchObject({
      category: direct, directServiceId: 'internal', serviceIds: ['internal'], serviceCount: 0, therapistCount: 1,
    });
    expect(JSON.stringify(catalog)).toBe(before);
  });

  it('omits groups and never falls back from missing internal service to a visible one', () => {
    expect(selectBookableClinicEntries({ categories: [group], services: [{ ...visible, categoryId: 'group' }] }, [{ isBookable: true, serviceIds: ['visible'] }])).toEqual([]);
    expect(getDirectClinicService([visible])).toBeUndefined();
    expect(selectBookableClinicEntries({ categories: [direct], services: [visible] }, [{ isBookable: true, serviceIds: ['visible'] }])).toEqual([]);
  });

  it('resolves a disabled internal row for editing but excludes it from booking', () => {
    const disabled = { ...internal, isActive: false };
    expect(getDirectClinicService([visible, disabled])).toBe(disabled);
    expect(getCategoryBookingServices(direct, [visible, disabled])).toEqual([]);
    expect(selectBookableClinicEntries({ categories: [direct], services: [visible, disabled] }, [{ isBookable: true, serviceIds: ['internal'] }])).toEqual([]);
  });

  it('uses visible, active, unarchived services and excludes inactive categories', () => {
    const category = { id: 'services', sortOrder: 0, isActive: true };
    const services = [
      { id: 'one', categoryId: 'services', isHidden: false },
      { id: 'hidden', categoryId: 'services', isHidden: true },
      { id: 'inactive', categoryId: 'services', isActive: false },
      { id: 'archived', categoryId: 'services', archivedAt: '2026-01-01' },
    ];
    expect(getCategoryBookingServices(category, services).map((s) => s.id)).toEqual(['one']);
    expect(selectBookableClinicEntries({ categories: [category, { id: 'off', isActive: false }], services }, [{ isBookable: true, serviceIds: ['one'] }])[0].serviceCount).toBe(1);
  });
});
