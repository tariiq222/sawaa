import React from 'react';
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', setThemeMode: jest.fn(), isRTL: true, language: 'ar' }),
}));
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: () => ({ firstName: 'نورة', lastName: 'ا', email: 'n@example.com' }),
}));
jest.mock('@/services/auth', () => ({ authService: { logout: jest.fn() } }));
jest.mock('@/hooks/queries', () => ({ useSummary: () => ({ data: null }), useBranding: () => ({ data: null }) }));
jest.mock('@/constants/config', () => ({ PRIVACY_POLICY_URL: 'https://example.com' }));
jest.mock('@/components/features/settings/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));

import ProfileScreen from '../profile';

describe('profile rows lead to purpose-specific pages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends notification settings to its own screen, not the general settings page', () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByText('settings.pushNotifications'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/settings-notifications');
  });

  it('sends the edit control to profile editing, not the general settings page', () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByText('profile.edit'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/settings-profile');
  });

  it('keeps general settings for the general row only', () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByText('settings.title'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/settings');
  });

  it('keeps the edit control a fixed compact pill instead of stretching with the profile row', () => {
    const screen = render(<ProfileScreen />);
    // The control is the nearest ancestor that pins a height (Glass renders the wrapper).
    let control = screen.getByText('profile.edit').parent;
    while (control && StyleSheet.flatten(control.props?.style)?.height == null) {
      control = control.parent;
    }
    expect(StyleSheet.flatten(control?.props?.style)).toMatchObject({
      height: 32,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
    });
  });

  it('never routes two different rows to the same destination', () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByText('settings.pushNotifications'));
    fireEvent.press(screen.getByText('profile.edit'));
    fireEvent.press(screen.getByText('settings.title'));

    const destinations = mockPush.mock.calls.map(([href]) => href);
    expect(new Set(destinations).size).toBe(destinations.length);
  });
});
