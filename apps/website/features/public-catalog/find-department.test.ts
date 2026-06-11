import { describe, it, expect } from 'vitest';
import { findDepartment } from './find-department';
import type { PublicDepartment } from './types';

function dept(partial: Partial<PublicDepartment>): PublicDepartment {
  return {
    id: partial.id ?? 'dep-1',
    nameAr: partial.nameAr ?? '',
    nameEn: partial.nameEn ?? null,
    descriptionAr: null,
    descriptionEn: null,
    icon: null,
    sortOrder: 0,
    isVisible: true,
    isActive: true,
    ...partial,
  };
}

describe('findDepartment', () => {
  it('matches an exact Arabic name (production shape: "جماعية")', () => {
    const departments = [
      dept({ id: 'clinics', nameAr: 'عيادات' }),
      dept({ id: 'groups', nameAr: 'جماعية' }),
    ];
    expect(findDepartment(departments, { ar: ['جماعية'], en: ['group'] })?.id).toBe('groups');
  });

  it('matches a longer Arabic name containing the keyword (local shape: "جلسات جماعية")', () => {
    const departments = [
      dept({ id: 'clinics', nameAr: 'عيادات سواء' }),
      dept({ id: 'groups', nameAr: 'جلسات جماعية' }),
      dept({ id: 'packages', nameAr: 'باقات سواء' }),
    ];
    expect(findDepartment(departments, { ar: ['جماعية'], en: ['group'] })?.id).toBe('groups');
    expect(findDepartment(departments, { ar: ['عيادات'], en: ['clinic'] })?.id).toBe('clinics');
  });

  it('falls back to a case-insensitive English match when nameAr has no keyword', () => {
    const departments = [
      dept({ id: 'other', nameAr: 'أخرى', nameEn: null }),
      dept({ id: 'groups', nameAr: 'البرامج', nameEn: 'Support Groups' }),
    ];
    expect(findDepartment(departments, { ar: ['جماعية'], en: ['group'] })?.id).toBe('groups');
  });

  it('returns undefined when nothing matches', () => {
    const departments = [
      dept({ id: 'clinics', nameAr: 'عيادات', nameEn: 'Clinics' }),
      dept({ id: 'noname', nameAr: 'باقات', nameEn: null }),
    ];
    expect(findDepartment(departments, { ar: ['جماعية'], en: ['group'] })).toBeUndefined();
    expect(findDepartment([], { ar: ['جماعية'], en: ['group'] })).toBeUndefined();
  });
});
