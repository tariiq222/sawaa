import { describe, expect, it } from 'vitest';
import { presentDirectClinicServices } from './booking-catalog';

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
