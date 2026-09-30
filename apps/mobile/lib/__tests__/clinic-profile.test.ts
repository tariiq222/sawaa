import { getProfileBookingGroups, getProfileBookingServices } from '../clinic-profile';

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

describe('getProfileBookingGroups', () => {
  it('keeps two clinics distinct and scopes each to the practitioner assignments', () => {
    const services = getProfileBookingServices(catalog as never, ['internal', 'other']);
    const groups = getProfileBookingGroups(catalog as never, services);
    expect(groups.clinics.map(({ category, services: choices }) => [category.id, choices.map((choice) => choice.id)]))
      .toEqual([['direct', ['internal']], ['services', ['other']]]);
    expect(groups.serviceGroups).toEqual([]);
  });

  it('never substitutes a visible service for a missing internal direct service', () => {
    const broken = { ...catalog, services: catalog.services.filter((service) => service.id !== 'internal') };
    const services = getProfileBookingServices(broken as never, ['visible', 'other']);
    const groups = getProfileBookingGroups(broken as never, services);
    expect(groups.clinics.map(({ category }) => category.id)).toEqual(['services']);
    expect(services.map((service) => service.id)).toEqual(['other']);
  });

  it('retains the service-only deep-link scope inside its clinic', () => {
    const services = getProfileBookingServices(catalog as never, ['internal', 'other'], undefined, 'other');
    const groups = getProfileBookingGroups(catalog as never, services);
    expect(groups.clinics.map(({ category }) => category.id)).toEqual(['services']);
    expect(groups.clinics[0].services.map((service) => service.id)).toEqual(['other']);
  });
});
