import { applyTherapistFilters } from '@/features/therapists/therapistsFilter';
import type { PublicEmployeeItem } from '@/services/client/employees';

const make = (overrides: Partial<PublicEmployeeItem> = {}): PublicEmployeeItem => ({
  id: 'e1',
  slug: null,
  nameAr: 'أحمد',
  nameEn: 'Ahmed',
  title: null,
  specialty: 'General',
  specialtyAr: 'طب عام',
  publicBioAr: null,
  publicBioEn: null,
  publicImageUrl: null,
  gender: 'MALE',
  employmentType: 'FULL_TIME',
  serviceIds: [],
  isBookable: true,
  ratingAverage: null,
  ratingCount: 0,
  // Prices are integer halalas (1 SAR = 100 halalas) — 40000 halalas = 400 SAR.
  minServicePrice: 40000,
  isAvailableToday: false,
  ...overrides,
});

describe('applyTherapistFilters', () => {
  describe('text search', () => {
    it('returns all when query is empty', () => {
      const list = [make()];
      expect(applyTherapistFilters(list, '', null)).toHaveLength(1);
    });

    it('filters by Arabic name', () => {
      const list = [make({ nameAr: 'سارة' }), make({ id: 'e2', nameAr: 'علي' })];
      expect(applyTherapistFilters(list, 'ساره', null)).toHaveLength(0);
      expect(applyTherapistFilters(list, 'سار', null)).toHaveLength(1);
    });

    it('filters by English name case-insensitively', () => {
      const list = [make({ nameEn: 'Sara' }), make({ id: 'e2', nameEn: 'Omar' })];
      expect(applyTherapistFilters(list, 'sara', null)).toHaveLength(1);
    });

    it('filters by specialty', () => {
      const list = [make({ specialty: 'Dentistry' }), make({ id: 'e2', specialty: 'General' })];
      expect(applyTherapistFilters(list, 'dent', null)).toHaveLength(1);
    });
  });

  describe('chip: available', () => {
    it('shows only employees available today', () => {
      const list = [
        make({ isAvailableToday: true }),
        make({ id: 'e2', isAvailableToday: false }),
      ];
      expect(applyTherapistFilters(list, '', 'available')).toHaveLength(1);
    });
  });

  describe('chip: women', () => {
    it('shows only female employees', () => {
      const list = [
        make({ gender: 'FEMALE' }),
        make({ id: 'e2', gender: 'MALE' }),
      ];
      expect(applyTherapistFilters(list, '', 'women')).toHaveLength(1);
      expect(applyTherapistFilters(list, '', 'women')[0].gender).toBe('FEMALE');
    });
  });

  describe('chip: remote', () => {
    it('shows only remote-type employees', () => {
      const list = [
        make({ employmentType: 'REMOTE' }),
        make({ id: 'e2', employmentType: 'FULL_TIME' }),
      ];
      expect(applyTherapistFilters(list, '', 'remote')).toHaveLength(1);
    });
  });

  describe('chip: under300', () => {
    it('compares halalas against the 300 SAR ceiling, not against 300 halalas', () => {
      const list = [
        make({ minServicePrice: 20000 }), // 200 SAR — under
        make({ id: 'e2', minServicePrice: 35000 }), // 350 SAR — over
        make({ id: 'e3', minServicePrice: null }),
      ];
      const result = applyTherapistFilters(list, '', 'under300');
      expect(result).toHaveLength(1);
      expect(result[0].minServicePrice).toBe(20000);
    });

    it('excludes an employee priced exactly at 300 SAR (exclusive ceiling)', () => {
      const list = [make({ minServicePrice: 30000 })];
      expect(applyTherapistFilters(list, '', 'under300')).toHaveLength(0);
    });
  });

  describe('combined search + chip', () => {
    it('applies both text search and chip filter simultaneously', () => {
      const list = [
        make({ nameAr: 'سارة', gender: 'FEMALE', isAvailableToday: true }),
        make({ id: 'e2', nameAr: 'هند', gender: 'FEMALE', isAvailableToday: false }),
        make({ id: 'e3', nameAr: 'عمر', gender: 'MALE', isAvailableToday: true }),
      ];
      // Women chip + "سار" search → only سارة
      const result = applyTherapistFilters(list, 'سار', 'women');
      expect(result).toHaveLength(1);
      expect(result[0].nameAr).toBe('سارة');
    });
  });
});
