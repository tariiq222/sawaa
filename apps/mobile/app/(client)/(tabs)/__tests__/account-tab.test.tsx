import React from 'react';
import { Linking } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockLogout = jest.fn().mockResolvedValue(undefined);
const mockRefetch = jest.fn();
const mockSetThemeMode = jest.fn();
const mockMutatePush = jest.fn().mockResolvedValue(undefined);
let mockContactPhone: string | null = null;
let mockSummary: { data?: { totalBookings: number; lastVisit: string | null; outstandingBalance: number }; isPending: boolean; isError: boolean; refetch: jest.Mock };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', writingDirection: 'rtl' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar', setThemeMode: mockSetThemeMode }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (select: (s: unknown) => unknown) => select({ auth: { user: { id: 'c1', firstName: 'نورة', lastName: 'ا', email: 'n@example.com', phone: '+966500000001', avatarUrl: null } } }) }));
jest.mock('@/services/auth', () => ({ authService: { logout: () => mockLogout() } }));
jest.mock('@/hooks/queries', () => ({ useSummary: () => mockSummary, useBranding: () => ({ data: { contactPhone: mockContactPhone } }) }));
jest.mock('@/hooks/queries/usePushPreference', () => ({ usePushPreference: () => ({ query: { data: { enabled: false, permitted: true }, isPending: false, isError: false, refetch: jest.fn() }, mutation: { mutateAsync: mockMutatePush, isPending: false } }) }));
jest.mock('@/hooks/queries/useClientProfile', () => ({ useUpdateClientProfile: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success' } }));
jest.mock('@/hooks/language-preference', () => ({ LANGUAGE_KEY: 'language' }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));
jest.mock('@/constants/config', () => ({ PRIVACY_POLICY_URL: 'https://example.com/privacy' }));

import AccountTabScreen from '../account';
import { formatCurrencyAmount } from '@/lib/currency-display';

beforeEach(() => {
  jest.clearAllMocks();
  mockContactPhone = null;
  mockSummary = { data: { totalBookings: 7, lastVisit: '2026-04-01T00:00:00.000Z', outstandingBalance: 12000 }, isPending: false, isError: false, refetch: mockRefetch };
});

describe('client account tab', () => {
  it('opens only two sub-pages: personal details and packages', () => {
    const view = render(<AccountTabScreen />);
    fireEvent.press(view.getByRole('button', { name: /profile\.personalDetails/ }));
    fireEvent.press(view.getByRole('button', { name: 'profile.myPackages' }));
    expect(mockPush.mock.calls).toEqual([['/(client)/settings-profile'], ['/(client)/packages/purchases']]);
  });

  it('drops entries that duplicate other tabs', () => {
    const view = render(<AccountTabScreen />);
    for (const removed of ['tabs.records', 'groups.title', 'profile.notifications', 'settings.title']) {
      expect(view.queryByText(removed)).toBeNull();
    }
  });

  it('changes preferences in place without navigating', async () => {
    const view = render(<AccountTabScreen />);
    fireEvent(view.getByLabelText('settings.darkMode'), 'valueChange', true);
    expect(mockSetThemeMode).toHaveBeenCalledWith('dark');
    fireEvent(view.getByLabelText('settings.pushNotifications'), 'valueChange', true);
    await waitFor(() => expect(mockMutatePush).toHaveBeenCalledWith(true));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the privacy policy and support phone', () => {
    mockContactPhone = '+966500000000';
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const view = render(<AccountTabScreen />);
    fireEvent.press(view.getByRole('button', { name: 'settings.privacyPolicy' }));
    fireEvent.press(view.getByRole('button', { name: 'profile.crisisSupport.title' }));
    expect(openURL.mock.calls).toEqual([['https://example.com/privacy'], ['tel:+966500000000']]);
    openURL.mockRestore();
  });

  it('renders the outstanding balance in SAR, never raw halalas', () => {
    const view = render(<AccountTabScreen />);
    expect(view.queryByText(/12,000/)).toBeNull();
    expect(view.getByText(formatCurrencyAmount(12000, 'SAR', true))).toBeTruthy();
  });

  it('shows loading, then a retryable error for the summary', () => {
    mockSummary = { data: undefined, isPending: true, isError: false, refetch: mockRefetch };
    const loading = render(<AccountTabScreen />);
    expect(loading.getByText('common.loading')).toBeTruthy();
    loading.unmount();
    mockSummary = { data: undefined, isPending: false, isError: true, refetch: mockRefetch };
    const failed = render(<AccountTabScreen />);
    expect(failed.getByText('profile.summaryLoadError')).toBeTruthy();
    fireEvent.press(failed.getByRole('button', { name: 'common.retry' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('asks before signing out and then returns to guest browsing', async () => {
    const view = render(<AccountTabScreen />);
    fireEvent.press(view.getByRole('button', { name: 'profile.signOut' }));
    expect(mockLogout).not.toHaveBeenCalled();
    const buttons = view.getAllByRole('button', { name: 'profile.signOut' });
    await act(async () => { fireEvent.press(buttons[buttons.length - 1]); });
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
  });
});
