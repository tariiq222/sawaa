import React from 'react';
import { render } from '@testing-library/react-native';

const mockNativeTabsProps = jest.fn();
const mockTriggerNames: string[] = [];
const mockLabels: Array<{ text: string; hidden?: boolean }> = [];
const mockTriggerProps: Array<{ name: string; unstable_nativeProps?: { tabBarItemAccessibilityLabel?: string } }> = [];
jest.mock('expo-router/unstable-native-tabs', () => {
  const Tabs = ({ children, ...props }: { children: React.ReactNode }) => {
    mockNativeTabsProps(props);
    return <>{children}</>;
  };
  const Trigger = Object.assign(
    ({ children, ...props }: { children: React.ReactNode; name: string; unstable_nativeProps?: { tabBarItemAccessibilityLabel?: string } }) => {
      mockTriggerNames.push(props.name);
      mockTriggerProps.push(props);
      return <>{children}</>;
    },
    {
      Icon: () => null,
      Label: ({ children, hidden }: { children: string; hidden?: boolean }) => {
        mockLabels.push({ text: children, hidden });
        return <>{children}</>;
      },
    },
  );
  Tabs.Trigger = Trigger;
  return { NativeTabs: Tabs };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

let mockScheme: 'light' | 'dark' = 'light';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: mockScheme }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({ teal: { 600: mockScheme === 'dark' ? 'dark-mint' : 'light-teal' } }),
}));

import ClientTabsLayout from '../_layout';

describe('client tab navigation', () => {
  beforeEach(() => {
    mockNativeTabsProps.mockClear();
    mockTriggerNames.length = 0;
    mockLabels.length = 0;
    mockTriggerProps.length = 0;
    mockScheme = 'light';
  });

  it('offers home, explore, my appointments, and account as the only client tabs', () => {
    render(<ClientTabsLayout />);
    expect([...mockTriggerNames].reverse()).toEqual(['home', 'appointments', 'explore', 'account']);
  });

  it('shows the four tab labels and keeps an accessible name for each', () => {
    render(<ClientTabsLayout />);
    expect([...mockTriggerProps].reverse().map((props) => props.unstable_nativeProps?.tabBarItemAccessibilityLabel))
      .toEqual(['tabs.home', 'tabs.myAppointments', 'tabs.explore', 'tabs.profile']);
    expect([...mockLabels].reverse()).toEqual([
      { text: 'tabs.home', hidden: undefined },
      { text: 'tabs.myAppointments', hidden: undefined },
      { text: 'tabs.explore', hidden: undefined },
      { text: 'tabs.profile', hidden: undefined },
    ]);
  });

  it('uses brand teal instead of the default blue selection', () => {
    render(<ClientTabsLayout />);
    expect(mockNativeTabsProps).toHaveBeenCalledWith(expect.objectContaining({ tintColor: 'light-teal' }));
  });

  it('re-reads the tint when the appearance changes', () => {
    // The bar's own colours come from the pinned native appearance; this only
    // guards that the tint we pass follows the scheme.
    const screen = render(<ClientTabsLayout />);
    expect(mockNativeTabsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ tintColor: 'light-teal' }),
    );

    mockScheme = 'dark';
    screen.rerender(<ClientTabsLayout />);

    expect(mockNativeTabsProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ tintColor: 'dark-mint' }),
    );
  });
});
