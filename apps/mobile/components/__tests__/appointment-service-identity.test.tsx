import React from 'react';
import { render } from '@testing-library/react-native';
import { buildDirState, DirContext } from '@/hooks/useDir';
import type { ClientBookingRow } from '@/services/client/bookings';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: false, language: 'en' }) }));
jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { name?: string }) => options?.name ? `${key}: ${options.name}` : key }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
const mockQuery = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useBooking: () => mockQuery(),
  useCancelBooking: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useBookingCancellationPreview: () => ({ data: undefined, isFetching: false }),
}));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));

import AppointmentDetail from '../../app/(client)/appointment/[id]';
import { AppointmentRowCard } from '../features/appointments/AppointmentRowCard';

const booking: ClientBookingRow = {
  id: 'a1', invoiceId: null, scheduledAt: '2026-10-01T10:00:00+03:00', durationMins: 60,
  status: 'cancelled', employeeId: 'e1', employee: { id: 'e1', nameEn: 'Nora', nameAr: 'نورة', avatarUrl: null },
  branchId: 'b1', serviceId: 's1', zoomJoinUrl: null, zoomStartUrl: null, zoomMeetingStatus: null,
};

// Removing service rendering or using practitioner identity for the service must fail both consumers.
describe.each(['detail', 'card'] as const)('%s booked service identity', (surface) => {
  function show(row: ClientBookingRow, locale: 'ar' | 'en' = 'en') {
    mockQuery.mockReturnValue({ data: row, isLoading: false, isError: false });
    return render(<DirContext.Provider value={buildDirState(locale)}>
      {surface === 'detail' ? <AppointmentDetail /> : <AppointmentRowCard booking={row} onPress={jest.fn()} showJoin={false} />}
    </DirContext.Provider>);
  }

  it('distinguishes two booked services under the same practitioner', () => {
    const first = show({ ...booking, serviceName: 'Family counseling' });
    expect(first.getByText('Family counseling')).toBeTruthy();
    expect(first.getByText('appointments.with: Nora')).toBeTruthy();
    first.unmount();
    const second = show({ ...booking, id: 'a2', serviceId: 's2', serviceName: 'Parenting assessment' });
    expect(second.getByText('Parenting assessment')).toBeTruthy();
    expect(second.getByText('appointments.with: Nora')).toBeTruthy();
    expect(second.queryByText('Family counseling')).toBeNull();
  });

  it.each([
    ['ar', { serviceName: 'Family counseling', serviceNameAr: 'إرشاد أسري' }, 'إرشاد أسري'],
    ['en', { serviceName: 'Family counseling', serviceNameAr: 'إرشاد أسري' }, 'Family counseling'],
    ['ar', { serviceName: 'Family counseling', serviceNameAr: '  ' }, 'Family counseling'],
    ['en', { serviceName: '', serviceNameAr: 'إرشاد أسري' }, 'إرشاد أسري'],
  ] as const)('uses the available snapshot for %s', (locale, names, expected) => {
    const screen = show({ ...booking, ...names, service: { id: 's1', nameEn: 'Changed catalog name', nameAr: 'اسم جديد' } }, locale);
    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText('Changed catalog name')).toBeNull();
    expect(screen.queryByText('اسم جديد')).toBeNull();
  });

  it.each([
    ['ar', 'إرشاد قديم', 'Legacy counseling', 'إرشاد قديم'],
    ['en', 'إرشاد قديم', 'Legacy counseling', 'Legacy counseling'],
    ['ar', null, 'Legacy counseling', 'Legacy counseling'],
    ['en', 'إرشاد قديم', null, 'إرشاد قديم'],
  ] as const)('supports legacy nested names for %s', (locale, nameAr, nameEn, expected) => {
    const screen = show({ ...booking, service: { id: 's1', nameAr, nameEn } }, locale);
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('omits the service line when every service name is absent', () => {
    const screen = show({ ...booking, serviceName: ' ', serviceNameAr: '', service: { id: 's1', nameAr: null, nameEn: null } });
    expect(screen.queryByTestId('appointment-service-name')).toBeNull();
    expect(screen.getByText('appointments.with: Nora')).toBeTruthy();
  });

  if (surface === 'card') {
    it('includes booked service identity in the accessible card label', () => {
      const screen = show({ ...booking, serviceName: 'Family counseling' });
      expect(screen.getByRole('button', { name: /Family counseling/ })).toBeTruthy();
    });
  }
});
