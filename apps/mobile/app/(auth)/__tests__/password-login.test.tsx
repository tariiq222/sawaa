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

const mockDispatch = jest.fn(); let mockEpoch = 1;
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => mockDispatch }));
jest.mock('@/services/password-login', () => ({ loginWithPassword: jest.fn() }));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn().mockResolvedValue({ success: true, data: { id: 'client', role: 'CLIENT' } }) }, SessionSupersededError: class extends Error {} }));
jest.mock('@/services/native-session-state', () => ({ isSessionCurrent: (epoch: number) => epoch === mockEpoch, fenceSession: () => ++mockEpoch, clearSessionAtEpoch: jest.fn().mockResolvedValue(true) }));
import LiveEmailEntry from '../email-entry';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { notifyManager } from '@tanstack/react-query';
const EmailEntryScreen = () => <QueryClientProvider client={new QueryClient()}><LiveEmailEntry /></QueryClientProvider>;
beforeAll(() => { notifyManager.setNotifyFunction(callback => { act(callback); }); });
afterAll(() => { notifyManager.setNotifyFunction(callback => callback()); });
import { loginWithPassword } from '@/services/password-login';
import { authService } from '@/services/auth';
const login = jest.mocked(loginWithPassword);
const session = { sessionEpoch: 1, sessionKind: 'client' as const, tokens: { accessToken: 'a', refreshToken: 'r' } };
beforeEach(() => { jest.clearAllMocks(); mockParams = {}; mockEpoch = 1; login.mockImplementation(async (_id, _pw, start) => { start?.(1); return session; }); });
function fill(ui: ReturnType<typeof render>) {
  fireEvent.changeText(ui.getByLabelText('auth.register.email'), 'sara@example.test');
  fireEvent.changeText(ui.getByLabelText('auth.password'), 'Secret1');
}
it('defaults to masked password with a visibility control and clears the password when switching modes', async () => {
  const ui = render(<EmailEntryScreen />); fill(ui);
  expect(ui.getByLabelText('auth.password').props.secureTextEntry).toBe(true);
  fireEvent.press(ui.getByRole('button', { name: 'common.showPassword' }));
  expect(ui.getByLabelText('auth.password').props.secureTextEntry).toBe(false);
  expect(ui.getByLabelText('auth.password').props.value).toBe('Secret1');
  fireEvent.press(ui.getByRole('button', { name: 'common.hidePassword' }));
  expect(ui.getByLabelText('auth.password').props.secureTextEntry).toBe(true);
  fireEvent.press(ui.getByText('auth.loginWithOtp'));
  await act(async () => undefined); // AppButton releases its press lock on a microtask
  expect(ui.queryByLabelText('auth.password')).toBeNull();
  fireEvent.press(ui.getByText('auth.loginWithPassword'));
  expect(ui.getByLabelText('auth.password').props.value).toBe('');
});
it('validates empty password and shows a generic failure for rejected credentials', async () => {
  const ui = render(<EmailEntryScreen />);
  fireEvent.changeText(ui.getByLabelText('auth.register.email'), 'sara@example.test');
  await act(async () => { fireEvent.press(ui.getByText('auth.loginNow')); });
  expect(ui.getByText('auth.passwordRequired')).toBeTruthy(); expect(login).not.toHaveBeenCalled();
  fill(ui); login.mockRejectedValueOnce(new Error('private backend details'));
  fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(ui.getByText('auth.loginError')).toBeTruthy());
  expect(mockReplace).not.toHaveBeenCalled();
});
it('completes a password login directly into booking continuation', async () => {
  mockParams = { booking: JSON.stringify({ clinicId: 'c', serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'in_person', scheduledAt: '2026-10-08T10:00:00.000Z', amount: '45000', currency: 'SAR' }) };
  const ui = render(<EmailEntryScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/confirm', params: { clinicId: 'c', serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'in_person', scheduledAt: '2026-10-08T10:00:00.000Z', chargedPrice: '45000', currency: 'SAR' } }));
  expect(mockDispatch).toHaveBeenCalled();
});
it('routes a staff password session to the employee home', async () => {
  login.mockImplementationOnce(async (_id, _pw, start) => { start?.(1); return { ...session, sessionKind: 'staff' as const }; });
  jest.mocked(authService.getProfile).mockResolvedValueOnce({ success: true, data: { id: 'staff', role: 'EMPLOYEE' } } as Awaited<ReturnType<typeof authService.getProfile>>);
  const ui = render(<EmailEntryScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today'));
  expect(authService.getProfile).toHaveBeenCalledWith('staff');
});
it.each(['switch', 'back', 'unmount'])('suppresses a late password response after %s', async action => {
  let resolve!: (value: typeof session) => void;
  login.mockImplementationOnce((_id, _pw, start) => { start?.(1); return new Promise(r => { resolve = r; }); });
  const ui = render(<EmailEntryScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  if (action === 'switch') fireEvent.press(ui.getByText('auth.loginWithOtp'));
  else if (action === 'back') { fireEvent.press(ui.getByLabelText('a11y.buttonBack')); expect(mockBack).toHaveBeenCalled(); ui.unmount(); }
  else ui.unmount();
  await act(async () => resolve(session));
  expect(authService.getProfile).not.toHaveBeenCalled(); expect(mockDispatch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});
it('suppresses profile completion when switching modes after tokens arrive', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof authService.getProfile>>) => void;
  jest.mocked(authService.getProfile).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const ui = render(<EmailEntryScreen />); fill(ui); fireEvent.press(ui.getByText('auth.loginNow'));
  await waitFor(() => expect(authService.getProfile).toHaveBeenCalled());
  fireEvent.press(ui.getByText('auth.loginWithOtp'));
  await act(async () => resolve({ success: true, data: { id: 'client', role: 'CLIENT' } } as Awaited<ReturnType<typeof authService.getProfile>>));
  expect(mockDispatch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('opens forgot-password with the typed email and the booking continuation', async () => {
  mockParams = { booking: 'svc-1' };
  const ui = render(<EmailEntryScreen />);
  fireEvent.changeText(ui.getByLabelText('auth.register.email'), 'sara@example.test');
  fireEvent.press(ui.getByText('auth.forgotPassword.linkLabel'));
  await act(async () => undefined);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/forgot-password', params: { booking: 'svc-1', identifier: 'sara@example.test' } });
  expect(login).not.toHaveBeenCalled();
});
