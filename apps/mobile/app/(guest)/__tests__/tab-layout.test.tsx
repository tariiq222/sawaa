import React from 'react';
import { render } from '@testing-library/react-native';

const mockNativeTabOptions = jest.fn();
const mockTriggerNames: string[] = [];

jest.mock('expo-router/unstable-native-tabs', () => {
  const { Text } = require('react-native');
  const NativeTabs = ({ children, ...options }: { children: React.ReactNode }) => {
    mockNativeTabOptions(options);
    return <>{children}</>;
  };
  NativeTabs.Trigger = Object.assign(
    ({ name, children }: { name: string; children: React.ReactNode }) => {
      mockTriggerNames.push(name);
      return <>{children}</>;
    },
    { Icon: () => null, Label: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> },
  );
  return { NativeTabs };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({ teal: { 600: 'brand-teal' }, ink: { 700: 'idle-ink' } }),
}));

let mockIsRTL = true;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: mockIsRTL, locale: mockIsRTL ? 'ar' : 'en' }) }));

import { getFontName } from '@/theme/fonts';
import GuestTabsLayout from '../_layout';

describe('guest tab navigation', () => {
  beforeEach(() => {
    mockNativeTabOptions.mockClear();
    mockTriggerNames.length = 0;
    mockIsRTL = true;
  });

  it('shows the four guest tabs in the native tab bar, mirrored for Arabic', () => {
    const screen = render(<GuestTabsLayout />);
    expect(mockTriggerNames).toEqual(['guest-account', 'explore', 'appointments', 'home']);
    for (const label of ['tabs.profile', 'tabs.explore', 'tabs.appointments', 'tabs.home']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('keeps the English order and colours the icons from the brand palette', () => {
    mockIsRTL = false;
    render(<GuestTabsLayout />);
    expect(mockTriggerNames).toEqual(['home', 'appointments', 'explore', 'guest-account']);
    expect(mockNativeTabOptions).toHaveBeenCalledWith(expect.objectContaining({
      labelStyle: { fontFamily: getFontName(mockIsRTL ? 'ar' : 'en', '500') },
      tintColor: 'brand-teal',
      iconColor: { default: 'idle-ink', selected: 'brand-teal' },
    }));
  });
});

it.each([true, false])('uses locale font from the shared tab hook: RTL=%s', rtl => {
 mockIsRTL = rtl; render(<GuestTabsLayout />);
 expect(mockNativeTabOptions).toHaveBeenLastCalledWith(expect.objectContaining({ labelStyle: { fontFamily: getFontName(rtl ? 'ar' : 'en', '500') } }));
});
