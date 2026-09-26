import React from 'react';
import { render } from '@testing-library/react-native';

let mockSignedIn = false;
let mockCanGoBack = false;
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ kind: 'clinics' }),
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack, push: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockSignedIn ? 'token' : null } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: true, row: 'row-reverse', textAlign: 'right', locale: 'ar' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>;
  },
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ teal: { 700: 'teal' }, ink: { 900: 'black', 500: 'grey' } }) }));
jest.mock('@/hooks/queries', () => ({
  useClinics: () => ({ data: [], isLoading: false }),
  useTherapists: () => ({ data: [], isLoading: false }),
  useGroupSessions: () => ({ data: [], isLoading: false }),
  usePackageFamilies: () => ({ data: [], isLoading: false }),
}));
jest.mock('@/components/features/home/GuestDock', () => ({
  GuestDock: () => { const { Text } = require('react-native'); return <Text>guest-dock</Text>; },
}));

import PublicListScreen from '../public-list/[kind]';

it('keeps public navigation available on guest list pages only', () => {
  mockSignedIn = false;
  const guest = render(<PublicListScreen />);
  expect(guest.getByText('guest-dock')).toBeTruthy();
  guest.unmount();

  mockSignedIn = true;
  const client = render(<PublicListScreen />);
  expect(client.queryByText('guest-dock')).toBeNull();
});

it('returns to public home when a list has no history entry', () => {
  mockSignedIn = false;
  mockCanGoBack = false;
  mockReplace.mockClear();
  mockBack.mockClear();
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByRole('button', { name: 'a11y.buttonBack' }));
  expect(mockReplace).toHaveBeenCalledWith('/home');
  expect(mockBack).not.toHaveBeenCalled();
});
