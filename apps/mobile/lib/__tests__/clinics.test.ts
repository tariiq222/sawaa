import { deriveClinics } from '../clinics';

const catalog = {
  departments: [
    { id: 'dep-clinics', nameAr: 'عيادات سواء', nameEn: null },
    { id: 'dep-groups', nameAr: 'جلسات جماعية', nameEn: null },
  ],
  categories: [
    { id: 'cat-1', departmentId: 'dep-clinics', nameAr: 'عيادة القلق', nameEn: 'Anxiety Clinic', sortOrder: 2 },
    { id: 'cat-2', departmentId: 'dep-clinics', nameAr: 'عيادة الأسرة', nameEn: null, sortOrder: 1 },
    { id: 'cat-empty', departmentId: 'dep-clinics', nameAr: 'فارغة', nameEn: null, sortOrder: 3 },
    { id: 'cat-other', departmentId: 'dep-groups', nameAr: 'مجموعة', nameEn: null, sortOrder: 1 },
  ],
  services: [
    { id: 'svc-1', categoryId: 'cat-1', nameAr: 'جلسة قلق', nameEn: null, price: 30000, currency: 'SAR' },
    { id: 'svc-2', categoryId: 'cat-2', nameAr: 'جلسة أسرية', nameEn: null, price: 30000, currency: 'SAR' },
    { id: 'svc-3', categoryId: 'cat-other', nameAr: 'جلسة جماعية', nameEn: null, price: 10000, currency: 'SAR' },
  ],
};

const therapists = [
  { id: 'e1', serviceIds: ['svc-1'], isBookable: true },
  { id: 'e2', serviceIds: ['svc-1', 'svc-2'], isBookable: true },
];

describe('deriveClinics', () => {
  it('returns clinic categories sorted by sortOrder with counts, hiding empty ones', () => {
    const clinics = deriveClinics(catalog as never, therapists as never);
    expect(clinics.map((c) => c.id)).toEqual(['cat-2', 'cat-1']);
    expect(clinics[0]).toMatchObject({ nameAr: 'عيادة الأسرة', therapistCount: 1, serviceCount: 1 });
    expect(clinics[1]).toMatchObject({ nameAr: 'عيادة القلق', therapistCount: 2, serviceCount: 1 });
  });

  it('returns [] when no clinics department matches', () => {
    expect(deriveClinics({ departments: [], categories: [], services: [] } as never, [] as never)).toEqual([]);
  });
});
