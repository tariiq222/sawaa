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
  useSawaaColors: () => ({ teal: { 600: 'brand-teal' }, ink: { 900: 'adaptive-ink' } }),
}));

let mockIsRTL = true;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: mockIsRTL, locale: mockIsRTL ? 'ar' : 'en' }) }));

import ClientTabsLayout from '../_layout';

describe('client tab navigation', () => {
  beforeEach(() => {
    mockNativeTabOptions.mockClear();
    mockTriggerNames.length = 0;
    mockIsRTL = true;
  });

  it('shows all four Arabic labels in the native tab bar', () => {
    const screen = render(<ClientTabsLayout />);
    expect(mockTriggerNames).toEqual(['account', 'explore', 'appointments', 'home']);
    for (const label of ['tabs.profile', 'tabs.explore', 'tabs.myAppointments', 'tabs.home']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('keeps native layout and uses the brand color for the selected tab', () => {
    render(<ClientTabsLayout />);
    expect(mockNativeTabOptions).toHaveBeenCalledWith({ tintColor: 'brand-teal' });
  });

  it('keeps the English visual order', () => {
    mockIsRTL = false;
    render(<ClientTabsLayout />);
    expect(mockTriggerNames).toEqual(['home', 'appointments', 'explore', 'account']);
  });
});
