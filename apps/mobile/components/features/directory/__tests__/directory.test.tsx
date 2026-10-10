import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', alignStart: 'flex-end', writingDirection: 'rtl' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { price?: string; count?: number }) => (options?.price ? `${key} ${options.price}` : options?.count !== undefined ? `${key} ${options.count}` : key) }),
}));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel, testID }: React.PropsWithChildren<{ onPress?: () => void; accessibilityLabel?: string; testID?: string }>) => {
    const { Pressable, View } = require('react-native');
    return onPress
      ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}>{children}</Pressable>
      : <View>{children}</View>;
  },
}));

import type { ClinicEntry } from '@/lib/clinics';
import type { PublicEmployeeItem } from '@/services/client/employees';
import { ClinicCard, filterClinics } from '../ClinicCard';
import { TherapistCard, therapistDisplay } from '../TherapistCard';

const therapist: PublicEmployeeItem = {
  id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', title: 'أخصائية إرشاد', specialty: 'Family counselling',
  specialtyAr: 'إرشاد أسري', publicBioAr: null, publicBioEn: null, publicImageUrl: null, gender: null, employmentType: 'FULL_TIME',
  serviceIds: ['s1'], isBookable: true, minServicePrice: 15000, isAvailableToday: true,
};

const clinic: ClinicEntry = {
  id: 'clinic-1', nameAr: 'عيادة الأسرة', nameEn: 'Family clinic', therapistCount: 3, serviceCount: 2,
  serviceIds: ['s1', 's2'], bookingMode: 'SERVICES', directServiceId: null, descriptionAr: 'وصف', descriptionEn: null,
};

describe('TherapistCard', () => {
  it('shows only real fields: name, specialty with title, availability today and the lowest price', () => {
    const onPress = jest.fn();
    const screen = render(<TherapistCard item={therapist} onPress={onPress} />);
    expect(screen.getByText('سارة')).toBeTruthy();
    expect(screen.getByText('إرشاد أسري · أخصائية إرشاد')).toBeTruthy();
    expect(screen.getByText('therapists.availableToday')).toBeTruthy();
    expect(screen.getByText(/therapists\.fromPrice .+/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('omits availability and price when the directory has none, and never shows a zero price', () => {
    const screen = render(<TherapistCard item={{ ...therapist, isAvailableToday: false, minServicePrice: 0 }} onPress={jest.fn()} />);
    expect(screen.queryByText('therapists.availableToday')).toBeNull();
    expect(screen.queryByText(/therapists\.fromPrice/)).toBeNull();
  });

  it('compact mode hides price and availability', () => {
    const screen = render(<TherapistCard item={therapist} compact onPress={jest.fn()} />);
    expect(screen.queryByText('therapists.availableToday')).toBeNull();
    expect(screen.queryByText(/therapists\.fromPrice/)).toBeNull();
  });

  it('falls back across locales for the display name', () => {
    expect(therapistDisplay({ ...therapist, nameAr: null, nameEn: 'Sara' }, true, 'unknown').name).toBe('Sara');
    expect(therapistDisplay({ ...therapist, nameAr: null, nameEn: null }, true, 'unknown').name).toBe('unknown');
  });
});

describe('ClinicCard and filterClinics', () => {
  it('renders the real practitioner and service counts', () => {
    const screen = render(<ClinicCard clinic={clinic} onPress={jest.fn()} />);
    expect(screen.getByText('عيادة الأسرة')).toBeTruthy();
    expect(screen.getByText('clinics.therapistsCount 3')).toBeTruthy();
    expect(screen.getByText('clinics.servicesCount 2')).toBeTruthy();
  });

  it('filters by Arabic or English name, ignoring case and blanks', () => {
    const other: ClinicEntry = { ...clinic, id: 'clinic-2', nameAr: 'عيادة القلق', nameEn: 'Anxiety Clinic' };
    expect(filterClinics([clinic, other], '')).toHaveLength(2);
    expect(filterClinics([clinic, other], '  ').map((entry) => entry.id)).toEqual(['clinic-1', 'clinic-2']);
    expect(filterClinics([clinic, other], 'قلق').map((entry) => entry.id)).toEqual(['clinic-2']);
    expect(filterClinics([clinic, other], 'FAMILY').map((entry) => entry.id)).toEqual(['clinic-1']);
    expect(filterClinics([clinic, other], 'none')).toEqual([]);
  });
});

it.each([
  { rtl: true, specialtyAr: 'إرشاد أسري', title: '  إرشاد   أسري  ', expected: 'إرشاد أسري' },
  { rtl: false, specialtyAr: null, title: ' family counselling ', expected: 'Family counselling' },
  { rtl: true, specialtyAr: '  ', title: 'أخصائية إرشاد', expected: 'أخصائية إرشاد' },
])('does not repeat equivalent or blank practitioner descriptions: $expected', ({ rtl, specialtyAr, title, expected }) => {
  expect(therapistDisplay({ ...therapist, specialtyAr, title }, rtl, 'unknown').subtitle).toBe(expected);
});
