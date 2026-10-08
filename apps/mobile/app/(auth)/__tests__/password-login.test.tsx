import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

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
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light', isRTL: true, language: 'ar' }) }));
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
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({
  useRequestLoginOtp: () => ({ mutateAsync: mockOtp, isPending: false }),
}));

jest.mock('../email-entry', () => ({ __esModule: true, default: () => null }));


const mockOtp = jest.fn(); const mockDispatch = jest.fn(); let mockEpoch = 1;
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => mockDispatch }));
jest.mock('@/services/password-login', () => ({ loginWithPassword: jest.fn() }));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn().mockResolvedValue({ success: true, data: { id: 'client', role: 'CLIENT' } }) }, SessionSupersededError: class extends Error {} }));
jest.mock('@/services/native-session-state', () => ({ isSessionCurrent: (epoch: number) => epoch === mockEpoch, fenceSession: () => ++mockEpoch, clearSessionAtEpoch: jest.fn().mockResolvedValue(true) }));
import LoginScreen from '../login';
import { loginWithPassword } from '@/services/password-login';
import { authService } from '@/services/auth';
const login = jest.mocked(loginWithPassword);
const session = { sessionEpoch: 1, sessionKind: 'client' as const, tokens: { accessToken: 'a', refreshToken: 'r' } };
beforeEach(() => { jest.clearAllMocks(); mockParams = {}; mockEpoch = 1; login.mockImplementation(async (_id, _pw, start) => { start?.(1); return session; }); });
function fill(ui: ReturnType<typeof render>) {
  fireEvent.changeText(ui.getByLabelText('auth.login.identifier'), 'sara@example.test');
  fireEvent.changeText(ui.getByLabelText('auth.password'), 'Secret1');
}
it('defaults to masked password with a visibility control and retains identifier across modes', () => {
  const ui = render(<LoginScreen />); fill(ui);
  expect(ui.getByLabelText('auth.password').props.secureTextEntry).toBe(true);
  fireEvent.press(ui.getByLabelText('auth.showPassword'));
  expect(ui.getByLabelText('auth.password').props.secureTextEntry).toBe(false);
  fireEvent.press(ui.getByText('auth.loginWithOtp'));
  expect(ui.queryByLabelText('auth.password')).toBeNull();
  expect(ui.getByLabelText('auth.login.identifier').props.value).toBe('sara@example.test');
  fireEvent.press(ui.getByText('auth.loginWithPassword'));
  expect(ui.getByLabelText('auth.password').props.value).toBe('');
});
it('validates empty password and shows a generic failure for rejected credentials', async () => {
  const ui = render(<LoginScreen />);
  fireEvent.changeText(ui.getByLabelText('auth.login.identifier'), 'sara@example.test');
  await act(async () => { fireEvent.press(ui.getByText('auth.loginNow')); });
  expect(ui.getByText('auth.passwordRequired')).toBeTruthy(); expect(login).not.toHaveBeenCalled();
  fill(ui); login.mockRejectedValueOnce(new Error('private backend details'));
  fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(ui.getByText('auth.loginError')).toBeTruthy());
  expect(mockReplace).not.toHaveBeenCalled();
});
it('completes a password login directly into booking continuation', async () => {
  mockParams = { booking: JSON.stringify({ clinicId: 'c', serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'in_person', scheduledAt: '2026-10-08T10:00:00.000Z', amount: '45000', currency: 'SAR' }) };
  const ui = render(<LoginScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/confirm', params: { clinicId: 'c', serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'in_person', scheduledAt: '2026-10-08T10:00:00.000Z', chargedPrice: '45000', currency: 'SAR' } }));
  expect(mockDispatch).toHaveBeenCalled(); expect(mockOtp).not.toHaveBeenCalled();
});
it.each(['switch', 'back', 'unmount'])('suppresses a late password response after %s', async action => {
  let resolve!: (value: typeof session) => void;
  login.mockImplementationOnce((_id, _pw, start) => { start?.(1); return new Promise(r => { resolve = r; }); });
  const ui = render(<LoginScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  if (action === 'switch') fireEvent.press(ui.getByText('auth.loginWithOtp'));
  else if (action === 'back') fireEvent.press(ui.getByLabelText('a11y.buttonBack'));
  else ui.unmount();
  await act(async () => resolve(session));
  expect(authService.getProfile).not.toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('prefills recovery from the identifier while preserving continuation', () => {
  mockParams = { redirect: '/(client)/(tabs)/appointments' };
  const ui = render(<LoginScreen />); fill(ui); fireEvent.press(ui.getByText('auth.forgotPassword.linkLabel'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/forgot-password', params: { identifier: 'sara@example.test', redirect: '/(client)/(tabs)/appointments' } });
});

it('suppresses profile completion when switching modes after tokens arrive', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof authService.getProfile>>) => void;
  jest.mocked(authService.getProfile).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const ui = render(<LoginScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(authService.getProfile).toHaveBeenCalled());
  fireEvent.press(ui.getByText('auth.loginWithOtp'));
  await act(async () => resolve({ success: true, data: { id: 'client', role: 'CLIENT' } } as Awaited<ReturnType<typeof authService.getProfile>>));
  expect(mockDispatch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('suppresses a phone OTP navigation after switching modes', async () => {
  let resolve!: (value: { maskedIdentifier: string }) => void;
  mockOtp.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const ui = render(<LoginScreen />);
  fireEvent.changeText(ui.getByLabelText('auth.login.identifier'), '0501234567');
  fireEvent.press(ui.getByText('auth.loginWithOtp')); fireEvent.press(ui.getByText('auth.login.sendCode'));
  fireEvent.press(ui.getByText('auth.loginWithPassword'));
  await act(async () => resolve({ maskedIdentifier: '***67' }));
  expect(mockPush).not.toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled();
});
