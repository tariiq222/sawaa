import { buildExploreResults, filterExploreResults } from '../explore-directory';
import type { PackageFamily } from '@sawaa/shared/types';
import type { PublicCatalogRaw } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';
import type { Program } from '@/services/client/group-sessions';
import type { ClinicEntry } from '@/lib/clinics';

const clinic: ClinicEntry = {
  id: 'clinic-1', nameAr: 'عيادة الأسرة', nameEn: 'Family Clinic', therapistCount: 1,
  serviceCount: 1, serviceIds: ['service-1'], bookingMode: 'SERVICES' as const, directServiceId: null,
};

const catalog: PublicCatalogRaw = {
  departments: [],
  categories: [
    { id: 'clinic-1', departmentId: null, nameAr: 'عيادة الأسرة', nameEn: 'Family Clinic', sortOrder: 0, kind: 'CLINIC' as const, bookingMode: 'SERVICES' as const },
    { id: 'group-1', departmentId: null, nameAr: 'المقاييس', nameEn: 'Assessments', sortOrder: 1, kind: 'SERVICE_GROUP' as const, bookingMode: 'SERVICES' as const },
    { id: 'direct-1', departmentId: null, nameAr: 'عيادة مباشرة', nameEn: 'Direct Clinic', sortOrder: 2, kind: 'CLINIC' as const, bookingMode: 'DIRECT' as const },
  ],
  services: [
    { id: 'service-1', categoryId: 'clinic-1', nameAr: 'جلسة أسرية', nameEn: 'Family session', price: 200, currency: 'SAR', imageUrl: null },
    { id: 'service-2', categoryId: 'group-1', nameAr: 'مقياس القلق', nameEn: 'Anxiety assessment', price: 100, currency: 'SAR', imageUrl: null },
    { id: 'hidden', categoryId: 'group-1', nameAr: 'مخفي', nameEn: 'Hidden', price: 0, currency: 'SAR', imageUrl: null, isHidden: true },
    { id: 'unbookable', categoryId: 'group-1', nameAr: 'غير قابل للحجز', nameEn: 'Unbookable', price: 0, currency: 'SAR', imageUrl: null },
    { id: 'direct-hidden', categoryId: 'direct-1', nameAr: 'داخلي', nameEn: 'Internal', price: 0, currency: 'SAR', imageUrl: null, isHidden: true },
    { id: 'orphan', categoryId: null, nameAr: 'خدمة دون مجموعة', nameEn: 'Uncategorized', price: 0, currency: 'SAR', imageUrl: null },
    { id: 'broken-category', categoryId: 'missing', nameAr: 'مرجع ناقص', nameEn: 'Broken reference', price: 0, currency: 'SAR', imageUrl: null },
  ],
};

const therapists: PublicEmployeeItem[] = [{
  id: 'employee-1', slug: 'sara-example', nameAr: 'سارة', nameEn: 'Sara',
  title: null, specialty: 'Family counseling', specialtyAr: 'إرشاد أسري',
  publicBioAr: null, publicBioEn: null, publicImageUrl: null, gender: null,
  employmentType: 'FULL_TIME', serviceIds: ['service-1', 'service-2', 'orphan', 'broken-category'],
  isBookable: true, ratingAverage: null, ratingCount: 0, minServicePrice: null, isAvailableToday: false,
}];

const packageFamilies: PackageFamily[] = [{
  id: 'package-1', nameAr: 'باقة', nameEn: 'Package', isActive: true, isPublic: true,
  isStandalone: false, options: [],
}];
const programs: Program[] = [{
  id: 'program-1', ref: 1, title: 'برنامج', nameAr: 'برنامج', nameEn: 'Program',
  descriptionAr: null, descriptionEn: null, publicDescriptionAr: null, publicDescriptionEn: null,
  departmentId: 'department-1', branchId: 'branch-1', startDate: null, daysCount: 0,
  hoursPerDay: 0, minParticipants: 0, maxParticipants: 10, enrolledCount: 0,
  price: '0', currency: 'SAR', depositEnabled: false, depositAmount: null,
  status: 'PUBLISHED', isPublic: true, isFull: false, spotsLeft: 10,
}];

describe('Explore directory results', () => {
  it('preserves clinic and service ids in service result routes and excludes hidden catalog entries', () => {
    const results = buildExploreResults({
      clinics: [clinic], catalog, therapists, packages: [], programs: [], locale: 'en',
    });

    expect(results.find((entry) => entry.id === 'service-1')).toMatchObject({
      kind: 'service',
      route: { pathname: '/(client)/therapists', params: { clinicId: 'clinic-1', serviceId: 'service-1' } },
    });
    expect(results.find((entry) => entry.id === 'service-2')?.route).toEqual({
      pathname: '/(client)/therapists', params: { serviceId: 'service-2' },
    });
    expect(results.find((entry) => entry.id === 'orphan')?.route).toEqual({ pathname: '/(client)/therapists', params: { serviceId: 'orphan' } });
    expect(results.some((entry) => ['hidden', 'direct-hidden', 'unbookable', 'broken-category'].includes(entry.id))).toBe(false);
  });

  it('searches result names and specialist specialties across categories', () => {
    const results = buildExploreResults({ clinics: [clinic], catalog, therapists, packages: [], programs: [], locale: 'en' });
    expect(filterExploreResults(results, 'all', 'family').map((entry) => entry.kind)).toEqual(['clinic', 'service', 'therapist']);
    expect(filterExploreResults(results, 'therapist', 'family').map((entry) => entry.id)).toEqual(['employee-1']);
    expect(filterExploreResults(results, 'service', 'family').map((entry) => entry.id)).toEqual(['service-1']);
  });

  it('opens package and program results in their authenticated client flows', () => {
    const results = buildExploreResults({
      clinics: [], catalog, therapists: [], locale: 'ar',
      packages: packageFamilies,
      programs,
    });
    expect(results.find((entry) => entry.id === 'package-1')?.route).toEqual({
      pathname: '/(client)/packages/[id]', params: { id: 'package-1' },
    });
    expect(results.find((entry) => entry.id === 'program-1')?.route).toEqual({
      pathname: '/(client)/groups/[id]', params: { id: 'program-1' },
    });
  });
});
