import React from 'react';
import { render } from '@testing-library/react-native';

const mockNativeTabsProps = jest.fn();
jest.mock('expo-router/unstable-native-tabs', () => {
  const Tabs = ({ children, ...props }: { children: React.ReactNode }) => {
    mockNativeTabsProps(props);
    return <>{children}</>;
  };
  const Trigger = Object.assign(
    ({ children }: { children: React.ReactNode }) => <>{children}</>,
    {
      Icon: () => null,
      Label: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    mockScheme = 'light';
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
