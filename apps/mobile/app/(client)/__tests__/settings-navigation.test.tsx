import React from 'react';
import { createTestQueryEnvironment } from '@/test-utils/query-wrapper';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

const mockPush = jest.fn();
const mockSetThemeMode = jest.fn();
const mockMutatePush = jest.fn().mockResolvedValue(undefined);
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: jest.fn() } }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), language: 'ar', scheme: 'light', setThemeMode: mockSetThemeMode }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse' }) }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => {
  const { Pressable } = require('react-native');
  return <Pressable onPress={onPress}>{children}</Pressable>;
} }));
jest.mock('@/components/features/settings/SettingsScaffold', () => ({
  SettingsScaffold: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
  SettingsSectionHeader: ({ label }: { label: string }) => {
    const { Text } = require('react-native');
    return <Text>{label}</Text>;
  },
}));
jest.mock('@/components/ui/GlassSegmented', () => ({ GlassSegmented: () => null }));
jest.mock('@/components/ui/GlassSwitch', () => ({ GlassSwitch: ({ value, disabled, onValueChange, accessibilityLabel }: { value: boolean; disabled?: boolean; onValueChange: (value: boolean) => void; accessibilityLabel: string }) => {
  const { Pressable } = require('react-native');
  return <Pressable accessibilityRole="switch" accessibilityLabel={accessibilityLabel} accessibilityState={{ checked: value, disabled }} disabled={disabled} onPress={() => onValueChange(!value)} />;
} }));
jest.mock('expo-haptics', () => ({ ImpactFeedbackStyle: { Light: 'light' }, impactAsync: jest.fn() }));
jest.mock('@/hooks/queries/usePushPreference', () => ({ usePushPreference: () => ({
  query: { data: { enabled: false, permitted: true }, isPending: false, isError: false },
  mutation: { mutateAsync: mockMutatePush, isPending: false },
}) }));
jest.mock('@/components/features/settings/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (select: (state: { auth: { user: { id: string } } }) => unknown) => select({ auth: { user: { id: 'client-1' } } }) }));
jest.mock('@/services/client', () => ({ clientProfileService: { updateProfile: jest.fn().mockResolvedValue({ id: 'client-1' }) } }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => 1, isSessionCurrent: () => true }));
jest.mock('@/hooks/language-preference', () => ({ LANGUAGE_KEY: 'language' }));
jest.mock('@/constants/config', () => ({ PRIVACY_POLICY_URL: 'https://example.com/privacy' }));

import SettingsScreen from '../settings';

let queries: ReturnType<typeof createTestQueryEnvironment>;
beforeEach(() => { queries = createTestQueryEnvironment(); jest.clearAllMocks(); });
afterEach(() => queries.client.clear());

it('changes notification preference directly in settings and opens privacy policy', async () => {
  const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  const screen = render(<SettingsScreen />, { wrapper: queries.wrapper });

  fireEvent.press(screen.getByRole('switch', { name: 'settings.pushNotifications' }));
  fireEvent.press(screen.getByText('settings.privacyPolicy'));

  await waitFor(() => expect(mockMutatePush).toHaveBeenCalledWith(true));
  expect(mockPush).not.toHaveBeenCalled();
  expect(openURL).toHaveBeenCalledWith('https://example.com/privacy');
  openURL.mockRestore();
});

it('changes the saved appearance mode from the settings switch', () => {
  const screen = render(<SettingsScreen />, { wrapper: queries.wrapper });
  fireEvent.press(screen.getByRole('switch', { name: 'settings.darkMode' }));
  expect(mockSetThemeMode).toHaveBeenCalledWith('dark');
});
