import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { NavigatorScreenParams } from '@react-navigation/native';

let mockCanGoBack = true;
let mockParams: Record<string, string> = {};
const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return {
    __esModule: true,
    default: { View, Text },
    FadeIn: animation,
    FadeInDown: animation,
    FadeInUp: animation,
    Easing: { out: jest.fn(), cubic: jest.fn() },
  };
});

jest.mock('@/theme', () => ({ Glass: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, ...props }: React.PropsWithChildren<{ onPress?: () => void }>) =>
    require('react').createElement(require('react-native').Pressable, { onPress, ...props }, children),
}));
jest.mock('@/theme/sawaa', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    ...jest.requireActual('@/theme/sawaa/tokens'),
    AquaBackground: View,
    PrimaryButton: ({ label, onPress, disabled }: { label: string; onPress?: () => void; disabled?: boolean }) => (
      <Pressable onPress={onPress} disabled={disabled}>
        <Text>{label}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right', alignStart: 'flex-end', writingDirection: 'rtl' }),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', language: 'ar' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({
  useRequestLoginOtp: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('../email-entry', () => ({ __esModule: true, default: () => null }));

const mockDispatch = jest.fn(); let mockEpoch = 1;
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => mockDispatch }));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn().mockResolvedValue({ success: true, data: { id: 'u', role: 'CLIENT' } }) }, SessionSupersededError: class extends Error {} }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (e: number) => e === mockEpoch, beginSession: () => ++mockEpoch, fenceSession: () => ++mockEpoch, clearSessionAtEpoch: jest.fn().mockResolvedValue(true), persistSessionTokensAtEpoch: jest.fn().mockResolvedValue(true) }));
jest.mock('@/services/phone-entry', () => ({
  phoneEntryError: jest.requireActual('@/services/phone-entry').phoneEntryError,
  phoneEntryService: { request: jest.fn(), resend: jest.fn(), verify: jest.fn(), complete: jest.fn() },
}));

import LoginScreen from '../login';
import { getStateFromPath } from 'expo-router/build/fork/getStateFromPath';

type HomeRouteParams = {
  '(client)': NavigatorScreenParams<{ '(tabs)': NavigatorScreenParams<{ home: undefined }> }>;
  '(guest)': NavigatorScreenParams<{ home: undefined }>;
};

function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  const screen = render(<QueryClientProvider client={client}><LoginScreen /></QueryClientProvider>);
  return { screen, client };
}

describe('login screen escape routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = true;
    mockParams = {};
    mockEpoch = 1;
  });

  it('exposes a back control that returns to the previous screen', () => {
    const { screen } = mount();

    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('falls back to the public home when login was opened with no history', () => {
    mockCanGoBack = false;
    const { screen } = mount();

    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));

    expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('lets a guest continue browsing without signing in', () => {
    const { screen } = mount();

    fireEvent.press(screen.getByText('auth.login.continueAsGuest'));

    // Both homes share /home: resolve the consumer's actual destination using
    // Expo's group-aware matcher, so a bare path cannot silently select client.
    const state = getStateFromPath<HomeRouteParams>(mockReplace.mock.calls[0][0], {
      screens: {
        '(client)': { path: '(client)', screens: { '(tabs)': { path: '(tabs)', screens: { home: 'home' } } } },
        '(guest)': { path: '(guest)', screens: { home: 'home' } },
      },
    });
    expect(state?.routes[0].name).toBe('(guest)');
    expect(state?.routes[0].state?.routes[0].name).toBe('home');
  });

  it('shows the guest, email-entry and staff links when opened without a booking', () => {
    const { screen } = mount();

    expect(screen.getByText('auth.login.continueAsGuest')).toBeTruthy();
    expect(screen.getByText('auth.phoneEntry.emailLoginLink')).toBeTruthy();
    expect(screen.getByText('auth.phoneEntry.staffLoginLink')).toBeTruthy();
  });

  it('hides continue as guest but keeps the alternative entry links when opened from a booking', () => {
    mockParams = { booking: 'booking-token' };
    const { screen } = mount();

    expect(screen.queryByText('auth.login.continueAsGuest')).toBeNull();
    expect(screen.getByText('auth.phoneEntry.emailLoginLink')).toBeTruthy();
    expect(screen.getByText('auth.phoneEntry.staffLoginLink')).toBeTruthy();
  });
});
