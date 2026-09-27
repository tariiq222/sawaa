import React from 'react';
import { render } from '@testing-library/react-native';

const mockTabOptions = jest.fn();
const mockScreenProps: Array<{ name: string; options: Record<string, unknown> }> = [];
jest.mock('expo-router', () => {
  const Tabs = ({ children, screenOptions }: { children: React.ReactNode; screenOptions: Record<string, unknown> }) => {
    mockTabOptions(screenOptions);
    return <>{children}</>;
  };
  Tabs.Screen = ({ name, options }: { name: string; options: Record<string, unknown> }) => {
    mockScreenProps.push({ name, options });
    return null;
  };
  return { Tabs };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));

let mockIsRTL = true;
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: mockIsRTL, locale: mockIsRTL ? 'ar' : 'en' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => ({
    teal: { 50: 'pale-teal', 100: 'light-teal', 700: 'brand-teal' },
    ink: { 700: 'dark-ink', 900: 'deep-ink' },
    glass: { border: 'glass-rim' },
  }),
}));

import ClientTabsLayout from '../_layout';

describe('client tab navigation', () => {
  beforeEach(() => {
    mockTabOptions.mockClear();
    mockScreenProps.length = 0;
    mockIsRTL = true;
  });

  it('keeps the four client destinations in Arabic visual order and hides utility routes', () => {
    render(<ClientTabsLayout />);
    expect(mockScreenProps.map((screen) => screen.name))
      .toEqual(['account', 'explore', 'appointments', 'home', 'chat', 'records']);
    expect(mockScreenProps.slice(0, 4).map((screen) => screen.options.tabBarAccessibilityLabel))
      .toEqual(['tabs.profile', 'tabs.explore', 'tabs.myAppointments', 'tabs.home']);
    expect(mockScreenProps.slice(4).map((screen) => screen.options.href)).toEqual([null, null]);
  });

  it('uses a shorter rounded bar that clears the safe area', () => {
    render(<ClientTabsLayout />);
    expect(mockTabOptions).toHaveBeenCalledWith(expect.objectContaining({
      headerShown: false,
      tabBarActiveTintColor: 'brand-teal',
      tabBarStyle: expect.objectContaining({
        height: 62, borderRadius: 31, bottom: 32, backgroundColor: 'pale-teal',
      }),
    }));
  });

  it('keeps the English visual order', () => {
    mockIsRTL = false;
    render(<ClientTabsLayout />);
    expect(mockScreenProps.slice(0, 4).map((screen) => screen.name))
      .toEqual(['home', 'appointments', 'explore', 'account']);
  });
});
