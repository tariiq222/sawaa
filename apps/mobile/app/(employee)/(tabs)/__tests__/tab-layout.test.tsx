import React from 'react';
import { render } from '@testing-library/react-native';

const mockNativeTabOptions = jest.fn();
const mockTriggerNames: string[] = [];

jest.mock('expo-router', () => {
  const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Tabs.Screen = () => null;
  return { Tabs };
});
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
    {
      Icon: () => null,
      Label: ({ children, hidden }: { children: React.ReactNode; hidden?: boolean }) =>
        hidden ? null : <Text>{children}</Text>,
    },
  );
  return { NativeTabs };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({ teal: { 600: 'brand-teal' }, ink: { 700: 'idle-ink' } }),
}));

let mockIsRTL = true;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: mockIsRTL, locale: mockIsRTL ? 'ar' : 'en' }) }));

import { getFontName } from '@/theme/fonts';
import EmployeeTabsLayout from '../_layout';

describe('employee tab navigation', () => {
  beforeEach(() => {
    mockNativeTabOptions.mockClear();
    mockTriggerNames.length = 0;
    mockIsRTL = true;
  });

  it('shows all four Arabic labels in the native tab bar', () => {
    const screen = render(<EmployeeTabsLayout />);
    expect(mockTriggerNames).toEqual(['profile', 'clients', 'calendar', 'today']);
    for (const label of ['tabs.profile', 'tabs.clients', 'tabs.calendar', 'tabs.today']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('keeps native layout and uses the brand color for the selected tab', () => {
    render(<EmployeeTabsLayout />);
    expect(mockNativeTabOptions).toHaveBeenCalledWith({
      minimizeBehavior: 'onScrollDown',
      labelStyle: { fontFamily: getFontName(mockIsRTL ? 'ar' : 'en', '500') },
      tintColor: 'brand-teal',
      iconColor: { default: 'idle-ink', selected: 'brand-teal' },
    });
  });

  it('keeps the English visual order', () => {
    mockIsRTL = false;
    render(<EmployeeTabsLayout />);
    expect(mockTriggerNames).toEqual(['today', 'calendar', 'clients', 'profile']);
  });
});

it.each([true, false])('uses locale font from the shared tab hook: RTL=%s', rtl => {
 mockIsRTL = rtl; render(<EmployeeTabsLayout />);
 expect(mockNativeTabOptions).toHaveBeenLastCalledWith(expect.objectContaining({ labelStyle: { fontFamily: getFontName(rtl ? 'ar' : 'en', '500') } }));
});
