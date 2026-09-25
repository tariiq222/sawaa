import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: mockLocale === 'ar', language: mockLocale }) }));
import { Pressable as MockPressable, StyleSheet, Text as MockText } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import en from '../../i18n/en.json';
import ar from '../../i18n/ar.json';

let mockLocale: 'en' | 'ar' = 'en';
const mockPush = jest.fn();
const mockRefetch = jest.fn();
const mockBookings = jest.fn();
jest.mock('expo-router', () => ({ router: { push: mockPush }, useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key.split('.').reduce<unknown>((value, part) =>
    (value as Record<string, unknown>)?.[part], mockLocale === 'ar' ? require('../../i18n/ar.json') : require('../../i18n/en.json')) ?? key }),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: mockLocale, isRTL: mockLocale === 'ar', row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const native = require('react-native');
  const animation = { delay: () => animation, duration: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: native.View, Text: native.Text }, FadeIn: animation, FadeInDown: animation, FadeInUp: animation, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('lucide-react-native', () => ({ Clock: () => null }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native-calendars', () => ({
  Calendar: ({ onDayPress }: { onDayPress: (day: { dateString: string }) => void }) => (
    <MockPressable accessibilityRole="button" accessibilityLabel="Select another day" onPress={() => onDayPress({ dateString: '2030-01-15' })}><MockText>Select day</MockText></MockPressable>
  ),
}));
jest.mock('@/theme', () => ({ Glass: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa/tokens'),
  AquaBackground: ({ children }: React.PropsWithChildren) => <>{children}</>,
  GlassSurface: ({ children }: React.PropsWithChildren) => <>{children}</>,
  PrimaryButton: ({ label }: { label: string }) => <MockText>{label}</MockText>,
}));
jest.mock('@/theme/sawaa/GlassSurface', () => ({ GlassSurface: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('@/components/ui/StatusPill', () => ({ StatusPill: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => <MockText>Loading skeleton</MockText> }));
jest.mock('@/hooks/queries/useEmployeeDayBookings', () => ({ useEmployeeDayBookings: (date: string) => mockBookings(date) }));
jest.mock('@/hooks/queries', () => ({ useRequestLoginOtp: () => ({ isPending: false }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

import CalendarScreen from '../../app/(employee)/(tabs)/calendar';
import LoginScreen from '../../app/(auth)/login';

beforeEach(() => {
  jest.clearAllMocks();
  mockLocale = 'en';
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
    fireEvent.press(screen.getByRole('button', { name: 'Select another day' }));
    expect(mockBookings).toHaveBeenLastCalledWith('2030-01-15');
    expect(screen.getByText(en.common.noResults)).toBeTruthy();
    expect(screen.queryByText(en.doctor.noAppointmentsToday)).toBeNull();
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
