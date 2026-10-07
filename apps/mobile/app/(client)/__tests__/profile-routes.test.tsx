import React from 'react';
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', setThemeMode: jest.fn(), isRTL: true, language: 'ar' }),
}));
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockContactPhone: string | null = null;
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').Pressable }));
jest.mock('@/hooks/use-redux', () => ({
  useAppDispatch: () => jest.fn(),
  useAppSelector: () => ({ firstName: 'نورة', lastName: 'ا', email: 'n@example.com' }),
}));
jest.mock('@/services/auth', () => ({ authService: { logout: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('@/hooks/queries', () => ({ useSummary: () => ({ data: null }), useBranding: () => ({ data: { contactPhone: mockContactPhone } }) }));
jest.mock('@/constants/config', () => ({ PRIVACY_POLICY_URL: 'https://example.com' }));
jest.mock('@/components/features/settings/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/features/auth/UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: () => ({ type: 'auth/logout' }), setUser: jest.fn() }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));

import ProfileScreen from '../profile';
import EmployeeProfileScreen from '../../(employee)/(tabs)/profile';

describe('profile rows lead to purpose-specific pages', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns to guest browsing after signing out', async () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByText('profile.signOut'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(guest)/home'));
  });

  it('returns staff to guest browsing after confirmed sign-out', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByLabelText('auth.logout'));
    const confirm = alert.mock.calls[0][2]?.find((button) => button.style === 'destructive');
    expect(confirm).toBeDefined();
    await act(async () => { await confirm?.onPress?.(); });
    expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
    alert.mockRestore();
  });

  it('keeps preferences in settings and leaves one entry per care destination', () => {
    const screen = render(<ProfileScreen />);
    expect(screen.queryByText('settings.pushNotifications')).toBeNull();
    expect(screen.queryByText('settings.darkMode')).toBeNull();
    expect(screen.queryByText('packages.balance')).toBeNull();
    expect(screen.queryByText('settings.privacySecurity')).toBeNull();
    expect(screen.getAllByText('settings.title')).toHaveLength(1);
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

  it('provides account entries for package catalog, support groups, and session records', () => {
    const screen = render(<ProfileScreen asTab />);

    fireEvent.press(screen.getByText('packages.title'));
    fireEvent.press(screen.getByText('groups.title'));
    fireEvent.press(screen.getByText('tabs.records'));

    expect(mockPush.mock.calls).toEqual([
      ['/(client)/packages'],
      ['/(client)/groups'],
      ['/(client)/records'],
    ]);
  });

  it('opens the center support phone from the account screen', () => {
    mockContactPhone = '+966500000000';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const screen = render(<ProfileScreen asTab />);

    fireEvent.press(screen.getByText('profile.crisisSupport.title'));

    expect(openURL).toHaveBeenCalledWith('tel:+966500000000');
    mockContactPhone = null;
    openURL.mockRestore();
  });

  it('keeps profile editing accessible with a compact minimum 44pt target', () => {
    const screen = render(<ProfileScreen />);
    const control = screen.getByRole('button', { name: 'profile.edit' });
    expect(control).toHaveStyle({ minHeight: 44, minWidth: 68, alignSelf: 'center' });
    fireEvent.press(control);
    expect(mockPush).toHaveBeenCalledWith('/(client)/settings-profile');
  });

  it('never routes two different rows to the same destination', () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByText('packages.title'));
    fireEvent.press(screen.getByText('profile.edit'));
    fireEvent.press(screen.getByText('settings.title'));

    const destinations = mockPush.mock.calls.map(([href]) => href);
    expect(new Set(destinations).size).toBe(destinations.length);
  });
});
