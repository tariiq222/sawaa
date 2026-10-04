import { describe, expect, it } from 'vitest';
import { presentDirectClinicServices, selectAvailableBookingServices } from './booking-catalog';

describe('presentDirectClinicServices', () => {
  it('shows the clinic name for an internal direct-booking service without changing its id', () => {
    const services = [
      { id: 'direct-1', categoryId: 'clinic-1', isHidden: true, nameAr: 'خدمة داخلية', nameEn: 'Internal' },
      { id: 'visible-1', categoryId: 'clinic-1', isHidden: false, nameAr: 'جلسة', nameEn: 'Session' },
    ];
    const categories = [{ id: 'clinic-1', bookingMode: 'DIRECT' as const, nameAr: 'عيادة السعادة', nameEn: 'Happiness Clinic' }];

    expect(presentDirectClinicServices(services, categories)).toEqual([
      { ...services[0], nameAr: 'عيادة السعادة', nameEn: 'Happiness Clinic' },
      services[1],
    ]);
  });
});

describe('selectAvailableBookingServices', () => {
  it('offers a direct clinic by internal ID and scopes practitioner entry to their services', () => {
    const services = [
      { id: 'internal', categoryId: 'clinic', isHidden: true, nameAr: 'داخلية' },
      { id: 'ordinary', categoryId: 'group', nameAr: 'مساندة' },
    ];
    const categories = [
      { id: 'clinic', bookingMode: 'DIRECT' as const, nameAr: 'عيادة' },
      { id: 'group', kind: 'SERVICE_GROUP' as const, nameAr: 'مجموعة' },
    ];
    const bookable = new Set(['internal', 'ordinary']);
    expect(selectAvailableBookingServices(services, categories, bookable).map((service) => service.id)).toEqual(['internal', 'ordinary']);
    expect(selectAvailableBookingServices(services, categories, bookable, ['internal']).map((service) => service.id)).toEqual(['internal']);
  });
});
