import React from 'react';
import { Image } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { TherapistsRow } from '../TherapistsRow';
import { buildDirState } from '@/hooks/useDir';
import type { PublicEmployeeItem } from '@/services/client/employees';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const therapist: PublicEmployeeItem = {
  id: 'therapist-1', slug: 'amina', nameAr: 'أمينة', nameEn: 'Amina',
  title: null, specialty: 'Counseling', specialtyAr: null,
  publicBioAr: null, publicBioEn: null, publicImageUrl: 'https://example.com/amina.jpg',
  gender: null, employmentType: 'FULL_TIME', serviceIds: [], isBookable: true,
  minServicePrice: null, isAvailableToday: true,
};

const row = (employee = therapist) => (
  <TherapistsRow therapists={[employee]} dir={buildDirState('en')} f400="System" f600="System" f700="System" />
);

const photos = (view: ReturnType<typeof render>) => view.UNSAFE_queryAllByType(Image);

it('renders the public therapist photo', () => {
  const view = render(row());
  expect(photos(view)).toHaveLength(1);
  expect(photos(view)[0].props.source).toEqual({ uri: 'https://example.com/amina.jpg' });
});

it('shows the placeholder when no photo is available', () => {
  const view = render(row({ ...therapist, publicImageUrl: null }));
  expect(photos(view)).toHaveLength(0);
  expect(view.getByText('Amina')).toBeTruthy();
});

it('falls back to the placeholder after a failed image and tries a replacement URL', () => {
  const view = render(row());
  fireEvent(photos(view)[0], 'error', { nativeEvent: { error: 'Failed' } });
  expect(photos(view)).toHaveLength(0);
  view.rerender(row({ ...therapist, publicImageUrl: 'https://example.com/updated.jpg' }));
  expect(photos(view)[0].props.source).toEqual({ uri: 'https://example.com/updated.jpg' });
});
