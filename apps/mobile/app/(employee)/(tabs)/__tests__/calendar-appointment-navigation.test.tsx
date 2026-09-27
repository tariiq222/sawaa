import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (route: string) => mockPush(route) } }));
jest.mock('@/hooks/queries/useEmployeeDayBookings', () => ({
  useEmployeeDayBookings: () => ({ data: [{ id: 'booking-1', startTime: '10:00', status: 'confirmed', client: { firstName: 'Nora', lastName: 'A' } }], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('react-native-calendars', () => ({ Calendar: () => null }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => { const value: Record<string, unknown> = {}; for (const key of ['delay', 'duration', 'easing']) value[key] = () => value; return value; };
  return { __esModule: true, default: { View }, FadeInDown: chain(), Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa'), AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => { const { View } = require('react-native'); return { Glass: ({ children }: { children?: React.ReactNode }) => <View>{children}</View> }; });
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));

import i18n from '@/i18n';
import CalendarScreen from '../calendar';

it('opens the selected staff appointment from the calendar day', () => {
  const view = render(<CalendarScreen />);
  const appointment = view.getByRole('button', { name: /Nora A 10:00/ });
  expect(appointment.props.accessibilityLabel).toContain(i18n.t('appointments.confirmed'));
  fireEvent.press(appointment);
  expect(mockPush).toHaveBeenCalledWith('/(employee)/appointment/booking-1');
});
