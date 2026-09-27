import { getProfileBookingServices } from '../clinic-profile';

const catalog = {
  departments: [],
  categories: [
    { id: 'direct', departmentId: null, nameAr: 'عيادة', nameEn: null, sortOrder: 1, bookingMode: 'DIRECT' },
    { id: 'services', departmentId: null, nameAr: 'خدمات', nameEn: null, sortOrder: 2 },
  ],
  services: [
    { id: 'visible', categoryId: 'direct', nameAr: 'خاطئة', nameEn: null, price: 1, currency: 'SAR', imageUrl: null },
    { id: 'internal', categoryId: 'direct', nameAr: 'داخلية', nameEn: null, price: 1, currency: 'SAR', imageUrl: null, isHidden: true },
    { id: 'other', categoryId: 'services', nameAr: 'أخرى', nameEn: null, price: 1, currency: 'SAR', imageUrl: null },
  ],
} as const;

describe('getProfileBookingServices', () => {
  it('keeps direct context and chooses only the internal service', () => {
    expect(getProfileBookingServices(catalog as never, ['internal', 'other'], 'direct').map((item) => item.id)).toEqual(['internal']);
  });
  it('fails closed for invalid clinic and service context', () => {
    expect(getProfileBookingServices(catalog as never, ['internal', 'other'], 'missing')).toEqual([]);
    expect(getProfileBookingServices(catalog as never, ['internal', 'other'], 'direct', 'other')).toEqual([]);
  });
  it('keeps direct booking available in an unscoped profile without visible fallback', () => {
    expect(getProfileBookingServices(catalog as never, ['internal', 'other']).map((item) => item.id)).toEqual(['internal', 'other']);
  });
  it('retains an uncategorized visible legacy service on an unscoped profile', () => {
    const legacy = { ...catalog, services: [...catalog.services, { id: 'legacy', categoryId: null, nameAr: 'جلسة', nameEn: null, price: 1, currency: 'SAR', imageUrl: null }] };
    expect(getProfileBookingServices(legacy as never, ['legacy']).map((item) => item.id)).toEqual(['legacy']);
  });
});
