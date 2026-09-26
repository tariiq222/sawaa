import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
  const { Pressable } = require('react-native');
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>;
} }));
import { HomeDiscoveryCards } from '../HomeDiscoveryCards';

it.each([false, true])('restores four home destinations with signedIn=%s', (signedIn) => {
  mockPush.mockClear();
  const screen = render(<HomeDiscoveryCards signedIn={signedIn} />);
  const routes = [
    ['clinics.title', 'clinics', 'clinics'],
    ['guest.therapists', 'therapists', 'therapists'],
    ['guest.packages', 'packages', 'packages'],
    ['guest.programs', 'programs', 'groups'],
  ];
  expect(screen.getAllByRole('button')).toHaveLength(4);
  for (const [label, guest, client] of routes) {
    fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockPush).toHaveBeenLastCalledWith(signedIn ? `/(client)/${client}` : `/public-list/${guest}`);
  }
});
