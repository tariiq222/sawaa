import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: mockLocale === 'ar', language: mockLocale }) }));
import { StyleSheet, Text as MockText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import en from '../../i18n/en.json';
import ar from '../../i18n/ar.json';

let mockLocale: 'en' | 'ar' = 'en';
let mockLoginBooking: string | undefined;
let mockLoginRedirect: string | undefined;
const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockBookings = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (route: string) => mockPush(route) }, useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => ({ booking: mockLoginBooking, redirect: mockLoginRedirect }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').reduce<unknown>((value, part) =>
    (value as Record<string, unknown>)?.[part], mockLocale === 'ar' ? require('../../i18n/ar.json') : require('../../i18n/en.json')) ?? key }),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockLocale, isRTL: mockLocale === 'ar', row: 'row', textAlign: 'left', writingDirection: 'ltr', alignStart: 'flex-start' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const native = require('react-native');
  const animation = { delay: () => animation, duration: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: native.View, Text: native.Text }, FadeIn: animation, FadeInDown: animation, FadeInUp: animation, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('lucide-react-native', () => ({ Clock: () => null, ChevronLeft: () => null, ChevronRight: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@/theme', () => ({ Glass: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa/tokens'),
  AquaBackground: ({ children }: React.PropsWithChildren) => <>{children}</>,
  PrimaryButton: ({ label }: { label: string }) => <MockText>{label}</MockText>,
}));
jest.mock('@/components/ui/StatusPill', () => ({ StatusPill: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => <MockText>Loading skeleton</MockText> }));
jest.mock('@/hooks/queries/useEmployeeDayBookings', () => ({ useEmployeeDayBookings: (date: string) => mockBookings(date) }));
jest.mock('@/hooks/queries', () => ({ useRequestLoginOtp: () => ({ isPending: false }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

import { shiftDateKey } from '../../lib/employee-schedule';
import CalendarScreen from '../../app/(employee)/(tabs)/calendar';
jest.mock('../../app/(auth)/email-entry', () => ({ __esModule: true, default: () => null }));
import LoginScreen from '../../app/(auth)/login';

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'en';
  mockLoginBooking = undefined;
  mockLoginRedirect = undefined;
  mockBookings.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: mockRefetch });
});

describe('calendar query states', () => {
  it.each(['en', 'ar'] as const)('renders translated error and retries, not empty (%s)', (locale) => {
    mockLocale = locale;
    const copy = locale === 'ar' ? ar : en;
    mockBookings.mockReturnValue({ isLoading: false, isError: true, refetch: mockRefetch });
    const screen = render(<CalendarScreen />);
    expect(screen.getByText(copy.common.error)).toBeTruthy();
    expect(screen.queryByText(copy.common.noResults)).toBeNull();
    expect(screen.queryByText(copy.doctor.noAppointmentsToday)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: copy.common.retry }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('keeps loading exclusive of error and empty states', () => {
    mockBookings.mockReturnValue({ isLoading: true, isError: false, refetch: mockRefetch });
    const screen = render(<CalendarScreen />);
    expect(screen.getAllByText('Loading skeleton')).toHaveLength(3);
    expect(screen.queryByText(en.common.error)).toBeNull();
    expect(screen.queryByText(en.common.noResults)).toBeNull();
  });

  it('uses date-neutral empty copy after selecting another day', () => {
    const screen = render(<CalendarScreen />);
    const today = mockBookings.mock.calls[0][0] as string;
    const dayButtons = screen.getAllByRole('button').filter((button) => button.props.accessibilityState?.selected === false);
    expect(dayButtons).toHaveLength(6);
    fireEvent.press(dayButtons[0]);
    expect(mockBookings.mock.lastCall?.[0]).not.toBe(today);
    expect(screen.getByText(en.common.noResults)).toBeTruthy();
    expect(screen.queryByText(en.doctor.noAppointmentsToday)).toBeNull();
  });

  it('pages the day strip by whole weeks', () => {
    const screen = render(<CalendarScreen />);
    const today = mockBookings.mock.calls[0][0] as string;
    fireEvent.press(screen.getByRole('button', { name: en.doctor.nextWeek }));
    expect(mockBookings.mock.lastCall?.[0]).toBe(shiftDateKey(today, 7));
    fireEvent.press(screen.getByRole('button', { name: en.doctor.previousWeek }));
    fireEvent.press(screen.getByRole('button', { name: en.doctor.previousWeek }));
    expect(mockBookings.mock.lastCall?.[0]).toBe(shiftDateKey(today, -7));
  });

  it('opens availability management from the calendar', () => {
    const screen = render(<CalendarScreen />);
    fireEvent.press(screen.getByRole('button', { name: en.availability.manage }));
    expect(mockPush).toHaveBeenCalledWith('/(employee)/availability');
  });

  it('shows successful bookings without error or empty copy', () => {
    mockBookings.mockReturnValue({ data: [{ id: 'booking-1', startTime: '10:00', status: 'confirmed', client: { firstName: 'Test', lastName: 'Client' } }], isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<CalendarScreen />);
    expect(screen.getByText('Test Client')).toBeTruthy();
    expect(screen.queryByText(en.common.error)).toBeNull();
    expect(screen.queryByText(en.common.noResults)).toBeNull();
  });

  it('does not show stale bookings alongside an error', () => {
    mockBookings.mockReturnValue({ data: [{ id: 'stale', startTime: '10:00', status: 'confirmed', client: { firstName: 'Stale', lastName: 'Client' } }], isLoading: false, isError: true, refetch: mockRefetch });
    const screen = render(<CalendarScreen />);
    expect(screen.getByText(en.common.error)).toBeTruthy();
    expect(screen.queryByText('Stale Client')).toBeNull();
  });
});

describe('login navigation copy and touch targets', () => {
  it.each(['en', 'ar'] as const)('localizes forgot password and preserves navigation (%s)', (locale) => {
    mockLocale = locale;
    const copy = locale === 'ar' ? ar : en;
    const screen = render(<LoginScreen />);
    fireEvent.press(screen.getByText(copy.auth.forgotPassword.linkLabel));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('carries booking and redirect context through forgot-password and registration', () => {
    mockLoginBooking = '{"serviceId":"service-1"}';
    mockLoginRedirect = '/(client)/booking/confirm?serviceId=service-1';
    const screen = render(<LoginScreen />);

    fireEvent.press(screen.getByText(en.auth.forgotPassword.linkLabel));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/(auth)/forgot-password',
      params: { booking: mockLoginBooking, redirect: mockLoginRedirect },
    });
    mockPush.mockClear();

    fireEvent.press(screen.getByRole('link', { name: en.auth.createAccount }));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/(auth)/register',
      params: { booking: mockLoginBooking, redirect: mockLoginRedirect },
    });
  });

  it('provides at least 44-point targets for both navigation links', () => {
    const screen = render(<LoginScreen />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    for (const link of links) {
      const style = StyleSheet.flatten(link.props.style);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(style.minWidth).toBeGreaterThanOrEqual(44);
    }
    fireEvent.press(screen.getByRole('link', { name: en.auth.createAccount }));
    expect(mockPush).toHaveBeenCalledWith('/(auth)/register');
  });
});
