import { describe, it, expect } from 'vitest';
import { therapistDisplayName, initialsFromName } from './therapist-name';

const base = {
  nameAr: 'د. خالد العتيبي',
  nameEn: 'Dr. Khalid Al-Otaibi',
  user: { firstName: 'خالد', lastName: 'العتيبي' },
};

describe('therapistDisplayName', () => {
  it('uses Arabic name in AR locale', () => {
    expect(therapistDisplayName(base, true)).toBe('د. خالد العتيبي');
  });
  it('uses English name in EN locale', () => {
    expect(therapistDisplayName(base, false)).toBe('Dr. Khalid Al-Otaibi');
  });
  it('falls back to Arabic when English missing in EN locale', () => {
    expect(therapistDisplayName({ ...base, nameEn: null }, false)).toBe('د. خالد العتيبي');
  });
  it('falls back to the synthetic user name when both names are missing', () => {
    expect(
      therapistDisplayName(
        { nameAr: null, nameEn: null, user: { firstName: 'خالد', lastName: 'العتيبي' } },
        false,
      ),
    ).toBe('خالد العتيبي');
  });
});

describe('initialsFromName', () => {
  it('takes the first letter of the first two tokens', () => {
    expect(initialsFromName('Dr. Khalid')).toBe('DK');
  });
});
