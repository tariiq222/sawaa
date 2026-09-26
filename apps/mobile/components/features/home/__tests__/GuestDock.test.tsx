import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ImageBackground, StyleSheet } from 'react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockScheme: 'light' | 'dark' = 'dark';
let mockReduceMotion = false;
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: mockPush }) }));
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

import { GuestDock, GuestDiscoveryGrid } from '../GuestDock';

describe('GuestDock', () => {
  beforeEach(() => { mockReplace.mockClear(); mockPush.mockClear(); mockScheme = 'dark'; mockReduceMotion = false; });

  it('shows the four requested guest destinations and opens account from its icon', () => {
    const screen = render(<GuestDock active="home" />);
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'tabs.home' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'clinics.title' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'guest.therapists' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'tabs.profile' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'guest.packages' })).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'guest.therapists' }));
    expect(mockReplace).toHaveBeenCalledWith('/public-list/therapists');
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.profile' }));
    expect(mockReplace).toHaveBeenCalledWith('/guest-account');
  });

  it('allows returning to the public home from a list', () => {
    const screen = render(<GuestDock active="clinics" />);
    fireEvent.press(screen.getByRole('tab', { name: 'tabs.home' }));
    expect(mockReplace).toHaveBeenCalledWith('/home');
  });

  it('reselects the current list to clear any route filter', () => {
    const screen = render(<GuestDock active="therapists" />);
    fireEvent.press(screen.getByRole('tab', { name: 'guest.therapists' }));
    expect(mockReplace).toHaveBeenCalledWith('/public-list/therapists');
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
    expect(lensPosition()).toBe(-10);
    expect(StyleSheet.flatten(screen.getByTestId('dock-glass-lens').props.style).width).toBe(90);
    fireEvent(tabs[0], 'layout', { nativeEvent: { layout: { x: 50, width: 70 } } });
    expect(lensPosition()).toBe(40);
  });

  it('expands the lens only while a tab is pressed', () => {
    mockReduceMotion = true;
    const screen = render(<GuestDock active="home" />);
    const tab = screen.getByRole('tab', { name: 'tabs.home' });
    const lensScale = () => {
      const value = StyleSheet.flatten(screen.getByTestId('dock-glass-lens').props.style).transform[1].scale;
      return typeof value === 'number' ? value : value.__getValue();
    };
    expect(lensScale()).toBe(0.78);
    fireEvent(tab, 'pressIn');
    expect(lensScale()).toBe(1);
    fireEvent(tab, 'pressOut');
    expect(lensScale()).toBe(0.78);
  });

  it('offers icon-led public destinations on the home screen', () => {
    const screen = render(<GuestDiscoveryGrid />);
    fireEvent.press(screen.getByRole('button', { name: 'clinics.title' }));
    expect(mockPush).toHaveBeenCalledWith('/public-list/clinics');
    expect(screen.getByRole('button', { name: 'guest.programs' })).toBeTruthy();
  });

  it('shows four image-backed discovery cards with a short description for each section', () => {
    const screen = render(<GuestDiscoveryGrid />);
    expect(screen.UNSAFE_getAllByType(ImageBackground)).toHaveLength(4);
    expect(screen.getByText('guest.clinicsDescription')).toBeTruthy();
    expect(screen.getByText('guest.therapistsDescription')).toBeTruthy();
    expect(screen.getByText('guest.packagesDescription')).toBeTruthy();
    expect(screen.getByText('guest.programsDescription')).toBeTruthy();
  });
});
