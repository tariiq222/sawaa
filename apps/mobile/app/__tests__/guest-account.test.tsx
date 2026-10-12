import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', textAlign: 'right', row: 'row-reverse' }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));

jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/components/features/account/AccountPreferences', () => ({ AccountPreferences: () => null }));
jest.mock('@/components/features/account/CenterSupportSection', () => ({ CenterSupportSection: () => null }));
jest.mock('@/components/features/settings/AboutSection', () => ({ AboutSection: () => null }));

import GuestAccountScreen from '../(guest)/guest-account';
import GuestAppointmentsScreen from '../(guest)/appointments';

it('keeps the guest in account until they explicitly ask to sign in', () => {
  mockPush.mockClear();
  const screen = render(<GuestAccountScreen />);
  expect(screen.getByText('guest.welcomeTitle')).toBeTruthy();
  expect(screen.getByText('guest.benefitBook')).toBeTruthy();
  expect(screen.queryByText('profile.signOut')).toBeNull();
  expect(screen.queryByText('profile.edit')).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'guest.signInOrRegister' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/account' } });
});

it('uses the same sign-in destination from guest appointments', () => {
 mockPush.mockClear(); const view = render(<GuestAppointmentsScreen />);
 expect(view.getByText('guest.appointmentsTitle')).toBeTruthy();
 fireEvent.press(view.getByRole('button', { name: 'guest.signInForAppointments' }));
 expect(mockPush).toHaveBeenCalledTimes(1);
 expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/appointments' } });
});
