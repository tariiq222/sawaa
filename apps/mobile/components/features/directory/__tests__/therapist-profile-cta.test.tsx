import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: { colors: new Proxy({}, { get: () => '#000000' }) } }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', alignStart: 'flex-end', writingDirection: 'rtl' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel, testID }: React.PropsWithChildren<{ onPress?: () => void; accessibilityLabel?: string; testID?: string }>) => {
    const { Pressable, View } = require('react-native');
    return onPress
      ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}>{children}</Pressable>
      : <View>{children}</View>;
  },
}));

import type { PublicCatalogRaw, PublicService } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';
import { TherapistProfileView } from '../TherapistProfileView';

const service = (id: string): PublicService => ({
  id, categoryId: null, nameAr: `خدمة ${id}`, nameEn: `Service ${id}`, price: 10000, currency: 'SAR', imageUrl: null,
});

const catalog = (ids: string[]): PublicCatalogRaw => ({ departments: [], categories: [], services: ids.map(service) });

const employee = (serviceIds: string[]): PublicEmployeeItem => ({
  id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', title: null, specialty: null,
  specialtyAr: null, publicBioAr: 'نبذة', publicBioEn: 'Bio', publicImageUrl: null, gender: null, employmentType: 'FULL_TIME',
  serviceIds, isBookable: true, minServicePrice: 10000, isAvailableToday: false,
});

function renderProfile(serviceIds: string[], onBook = jest.fn()) {
  const screen = render(
    <TherapistProfileView
      employee={employee(serviceIds)}
      loading={false}
      catalog={catalog(serviceIds)}
      catalogLoading={false}
      onBack={jest.fn()}
      onBook={onBook}
    />,
  );
  return { screen, onBook };
}

describe('TherapistProfileView booking button', () => {
  it('opens on services with a disabled choose-to-continue button until a row is selected', () => {
    const { screen, onBook } = renderProfile(['a', 'b']);

    expect(screen.getByTestId('employee-service-a')).toBeTruthy();
    expect(screen.queryByText('نبذة')).toBeNull();
    expect(screen.queryByText('employeeProfile.bookAppointment')).toBeNull();
    const disabled = screen.getByText('employeeProfile.chooseToContinue');
    fireEvent.press(disabled);
    expect(onBook).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'employeeProfile.chooseToContinue' }).props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('employee-service-b'));

    // The therapist has a bio, yet the list must stay on screen after the choice.
    expect(screen.getByTestId('employee-service-b')).toBeTruthy();
    expect(screen.queryByText('نبذة')).toBeNull();
    expect(screen.queryByText('employeeProfile.chooseToContinue')).toBeNull();
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(onBook).toHaveBeenCalledWith('b', 'employee-1');
  });

  it('books immediately when there is a single option', () => {
    const { screen, onBook } = renderProfile(['a']);

    expect(screen.getByText('نبذة')).toBeTruthy();
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onBook).toHaveBeenCalledWith('a', 'employee-1');
  });
});

it('shows failed scoped services and retries without booking a fallback service', () => {
  const retry = jest.fn(); const book = jest.fn();
  const screen = render(<TherapistProfileView employee={employee(['a'])} loading={false} catalog={undefined} catalogLoading={false} catalogError onRetryCatalog={retry} clinicId="gone" onBack={jest.fn()} onBook={book} />);
  fireEvent.press(screen.getByText('employeeProfile.services'));
  expect(screen.queryByText('employeeProfile.noServices')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(retry).toHaveBeenCalledTimes(1); expect(book).not.toHaveBeenCalled();
});
it('retries an unavailable employee read without booking', () => {
  const retry = jest.fn(); const book = jest.fn();
  const screen = render(<TherapistProfileView employee={undefined} loading={false} employeeError onRetryEmployee={retry} catalog={undefined} catalogLoading={false} onBack={jest.fn()} onBook={book} />);
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(retry).toHaveBeenCalledTimes(1); expect(book).not.toHaveBeenCalled();
});
it('keeps cached scoped services visible when their refresh fails', () => {
  const screen = render(<TherapistProfileView employee={employee(['a'])} loading={false} catalog={catalog(['a'])} catalogLoading={false} catalogError onRetryCatalog={jest.fn()} onBack={jest.fn()} onBook={jest.fn()} />);
  fireEvent.press(screen.getByText('employeeProfile.services'));
  expect(screen.getByTestId('employee-service-a')).toBeTruthy();
  expect(screen.getByText('guest.loadError')).toBeTruthy();
});
it.each([undefined, 'invalid-clinic'])('keeps a genuinely empty or invalid clinic scope unbookable (%s)', (clinicId) => {
  const book = jest.fn();
  const screen = render(<TherapistProfileView employee={employee(['a'])} loading={false} catalog={catalog(clinicId ? ['a'] : [])} catalogLoading={false} clinicId={clinicId} onBack={jest.fn()} onBook={book} />);
  fireEvent.press(screen.getByText('employeeProfile.services'));
  expect(screen.getByText('employeeProfile.noServices')).toBeTruthy();
  expect(screen.queryByTestId('employee-service-a')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'employeeProfile.bookAppointment' }));
  expect(book).not.toHaveBeenCalled();
});
