import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockScheme: 'light' | 'dark' = 'dark';
let mockReduceMotion = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ row: 'row-reverse' }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: mockScheme }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors(mockScheme),
}));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/components/ui/FloatingActionBar', () => ({ FloatingActionBar: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => mockReduceMotion }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
    const { Pressable, View } = require('react-native');
    return onPress
      ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>
      : <View>{children}</View>;
  },
}));

import { GuestDock } from '../GuestDock';

describe('GuestDock', () => {
  beforeEach(() => { mockReplace.mockClear(); mockPush.mockClear(); mockScheme = 'dark'; mockReduceMotion = false; });

  it('shows the four requested guest destinations and opens account from its icon', () => {
    const screen = render(<GuestDock active="home" />);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'tabs.home' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'tabs.appointments' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'tabs.explore' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'tabs.profile' })).toBeTruthy();
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.explore' }));
    expect(mockReplace).toHaveBeenCalledWith('/explore');
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.appointments' }));
    expect(mockReplace).toHaveBeenCalledWith('/appointments');
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.profile' }));
    expect(mockReplace).toHaveBeenCalledWith('/guest-account');
  });

  it('allows returning to the public home from a list', () => {
    const screen = render(<GuestDock active="clinics" />);
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.home' }));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('routes a legacy directory page back to Explore', () => {
    const screen = render(<GuestDock active="therapists" />);
    expect(screen.getByRole('tab', { name: 'tabs.explore' }).props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.explore' }));
    expect(mockReplace).toHaveBeenCalledWith('/explore');
  });

  it('uses a separate glass lens for the selected light-mode tab', () => {
    mockScheme = 'light';
    const screen = render(<GuestDock active="home" />);
    expect(screen.getByTestId('dock-glass-lens')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'tabs.home' }).props.accessibilityState).toEqual({ selected: true });
  });

  it('moves the lens when the active icon changes position after a layout change', () => {
    mockReduceMotion = true;
    const screen = render(<GuestDock active="home" />);
    const tabs = screen.getAllByRole('tab');
    tabs.forEach((tab, index) => fireEvent(tab, 'layout', { nativeEvent: { layout: { x: index * 70, width: 70 } } }));
    const lensPosition = () => {
      const value = StyleSheet.flatten(screen.getByTestId('dock-glass-lens').props.style).transform[0].translateX;
      return typeof value === 'number' ? value : value.__getValue();
    };
    expect(lensPosition()).toBe(0);
    expect(StyleSheet.flatten(screen.getByTestId('dock-glass-lens').props.style).width).toBe(70);
    fireEvent(tabs[0], 'layout', { nativeEvent: { layout: { x: 50, width: 70 } } });
    expect(lensPosition()).toBe(50);
  });

  it('compresses the selected lens only while a tab is pressed', () => {
    mockReduceMotion = true;
    const screen = render(<GuestDock active="home" />);
    const tab = screen.getByRole('tab', { name: 'tabs.home' });
    const lensScale = () => {
      const value = StyleSheet.flatten(screen.getByTestId('dock-glass-lens').props.style).transform[1].scale;
      return typeof value === 'number' ? value : value.__getValue();
    };
    expect(lensScale()).toBe(1);
    fireEvent(tab, 'pressIn');
    expect(lensScale()).toBe(0.96);
    fireEvent(tab, 'pressOut');
    expect(lensScale()).toBe(1);
  });
});
