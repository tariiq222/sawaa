import React from 'react';
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

it('renders the public therapist photo', () => {
  const view = render(row());
  expect(view.getByRole('image', { name: 'Amina' })).toHaveProp('source', { uri: 'https://example.com/amina.jpg' });
  expect(view.queryByText('A')).toBeNull();
});

it('keeps the initial when no photo is available', () => {
  const view = render(row({ ...therapist, publicImageUrl: null }));
  expect(view.queryByRole('image')).toBeNull();
  expect(view.getByText('A')).toBeTruthy();
});

it('falls back to the initial after a failed image and tries a replacement URL', () => {
  const view = render(row());
  fireEvent(view.getByRole('image', { name: 'Amina' }), 'error', { nativeEvent: { error: 'Failed' } });
  expect(view.queryByRole('image')).toBeNull();
  expect(view.getByText('A')).toBeTruthy();
  view.rerender(row({ ...therapist, publicImageUrl: 'https://example.com/updated.jpg' }));
  expect(view.getByRole('image', { name: 'Amina' })).toHaveProp('source', { uri: 'https://example.com/updated.jpg' });
});
