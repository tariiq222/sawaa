import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockChangeLanguage = jest.fn(() => Promise.resolve());
const mockUpdateProfile = jest.fn(() => Promise.resolve());
let mockLanguage = 'ar';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { changeLanguage: mockChangeLanguage } }) }));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), language: mockLanguage, scheme: 'light', setThemeMode: jest.fn() }),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({ setItem: jest.fn(() => Promise.resolve()) }));
jest.mock('@/hooks/language-preference', () => ({ LANGUAGE_KEY: 'language' }));
jest.mock('expo-updates', () => ({ reloadAsync: jest.fn() }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/hooks/queries/useClientProfile', () => ({ useUpdateClientProfile: () => ({ mutateAsync: mockUpdateProfile }) }));
jest.mock('@/hooks/queries/usePushPreference', () => ({
  usePushPreference: () => ({ query: { data: undefined, isPending: false, isError: false }, mutation: { isPending: false } }),
}));
jest.mock('@/components/ui/MenuGroup', () => {
  const { Text, View } = require('react-native');
  return {
    MenuGroup: ({ entries }: { entries: { key: string; label: string; trailing?: React.ReactNode }[] }) => (
      <View>{entries.map((e) => <View key={e.key}><Text>{e.label}</Text>{e.trailing}</View>)}</View>
    ),
  };
});

import { AccountPreferences } from '../AccountPreferences';

beforeEach(() => { jest.clearAllMocks(); mockLanguage = 'ar'; });

it('shows language as a switch beside dark mode, off while Arabic is active', () => {
  const screen = render(<AccountPreferences role="guest" />);
  expect(screen.getByLabelText('settings.english').props.value).toBe(false);
  expect(screen.getByLabelText('settings.darkMode')).toBeTruthy();
  expect(screen.queryByLabelText('settings.pushNotifications')).toBeNull();
});

it('switches a guest to English without syncing a profile', async () => {
  const screen = render(<AccountPreferences role="guest" />);
  fireEvent(screen.getByLabelText('settings.english'), 'valueChange', true);
  await Promise.resolve();
  expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  expect(mockUpdateProfile).not.toHaveBeenCalled();
});

it('switches a client back to Arabic and syncs the preferred locale', async () => {
  mockLanguage = 'en';
  const screen = render(<AccountPreferences role="client" />);
  expect(screen.getByLabelText('settings.english').props.value).toBe(true);
  fireEvent(screen.getByLabelText('settings.english'), 'valueChange', false);
  await new Promise((r) => setImmediate(r));
  expect(mockChangeLanguage).toHaveBeenCalledWith('ar');
  expect(mockUpdateProfile).toHaveBeenCalledWith({ preferredLocale: 'ar' });
});
