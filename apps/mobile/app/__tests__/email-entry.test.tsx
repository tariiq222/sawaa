import React from 'react';
import { Alert } from 'react-native';
import ForgotPasswordScreen from '../(auth)/forgot-password';
import ResetPasswordScreen from '../(auth)/reset-password';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { emailEntryService } from '@/services/email-entry';
import { clearSessionAtEpoch, persistSessionTokensAtEpoch } from '@/services/native-session-state';
import { authService } from '@/services/auth';
import EmailEntryScreen from '../(auth)/email-entry';
import RegisterScreen from '../(auth)/register';
const mockLoginOtp = jest.fn().mockResolvedValue({ maskedIdentifier: '***12' });
jest.mock('@/hooks/queries', () => ({ useRequestLoginOtp: () => ({ mutateAsync: mockLoginOtp, isPending: false }) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), impactAsync: jest.fn(), NotificationFeedbackType: { Success: 'success', Error: 'error' }, ImpactFeedbackStyle: { Light: 'light' } }));
const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn(); let mockEpoch = 1;
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }), useLocalSearchParams: () => mockParams, useFocusEffect: jest.fn(), Redirect: ({ href }: { href: unknown }) => { mockRedirectHref = href; return null; } }));
jest.mock('@/theme', () => ({ Glass: jest.requireActual('@/theme/components/Glass').Glass }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('@/services/email-entry', () => ({ emailEntryError: jest.requireActual('@/services/email-entry').emailEntryError, emailEntryService: { request: jest.fn(), verify: jest.fn(), requestPhone: jest.fn(), verifyPhone: jest.fn(), resendPhone: jest.fn() } }));
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => jest.fn() }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (e: number) => e === mockEpoch, beginSession: () => ++mockEpoch, fenceSession: () => ++mockEpoch, clearSessionAtEpoch: jest.fn().mockResolvedValue(true), persistSessionTokensAtEpoch: jest.fn().mockResolvedValue(true) }));
jest.mock('@/services/auth', () => ({ authService: { requestPasswordResetOtp: jest.fn().mockResolvedValue({}), verifyPasswordResetOtp: jest.fn().mockResolvedValue({ sessionToken: 'verified-proof' }), resetClientPassword: jest.fn().mockResolvedValue({ success: true }), getProfile: jest.fn().mockResolvedValue({ success: true, data: { id: 'u', role: 'CLIENT' } }) }, SessionSupersededError: class extends Error {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: { colors: { surface: '#FFF', surfaceHigh: '#EEE', textPrimary: '#000', textSecondary: '#666', textMuted: '#999', primary: '#098a7d', primaryFill: '#087a6f', primaryGradient: ['#087a6f', '#066962'], primaryForeground: '#FFF' }, typography: { fontFamily: { arabic: 'System', english: 'System' } } }, isRTL: false, language: 'en' }) }));
let mockParams: Record<string, string> = { redirect: '/(client)/(tabs)/appointments' };
let mockRedirectHref: unknown = null;
const api = jest.mocked(emailEntryService);
const challenge = { challengeId: 'c', maskedEmail: 'a***@example.test', expiresIn: 300 as const, retryAfterSeconds: 60 as const };
function mount(component: React.ReactElement = <EmailEntryScreen />) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } })}>{component}</QueryClientProvider>); }
async function enterCode(ui: ReturnType<typeof mount>) {
  fireEvent.changeText(ui.getByLabelText('auth.register.email'), 'a@example.test');
  fireEvent.press(ui.getByText('auth.emailEntry.sendEmail'));
  await waitFor(() => expect(ui.getByLabelText('auth.emailEntry.code')).toBeTruthy());
}
beforeAll(() => { notifyManager.setNotifyFunction(callback => { act(callback); }); });
afterAll(() => { notifyManager.setNotifyFunction(callback => callback()); });
beforeEach(() => { jest.clearAllMocks(); mockEpoch = 1; mockParams = { redirect: '/(client)/(tabs)/appointments' }; mockRedirectHref = null; api.request.mockResolvedValue(challenge); });
it('accepts six-digit paste/autofill and prevents duplicate verification', async () => {
  api.verify.mockReturnValue(new Promise(() => {})); const ui = mount(); await enterCode(ui);
  const input = ui.getByLabelText('auth.emailEntry.code');
  expect(input.props.maxLength).toBe(6); expect(input.props.textContentType).toBe('oneTimeCode');
  fireEvent.changeText(input, '123456'); fireEvent.press(ui.getByText('auth.otp.submit')); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(api.verify).toHaveBeenCalledTimes(1));
  expect(api.verify).toHaveBeenCalledWith({ challengeId: 'c', code: '123456' });
});
it.each(['register', 'verify_phone'] as const)('keeps %s proof in the screen, without route secrets', async next => {
  api.verify.mockResolvedValue({ next, email: 'a@example.test', continuationToken: 'secret', expiresIn: 600 });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByLabelText('auth.register.phone')).toBeTruthy());
  expect(Boolean(ui.queryByLabelText('auth.register.firstName'))).toBe(next === 'register');
  expect(mockReplace).not.toHaveBeenCalled(); expect(persistSessionTokensAtEpoch).not.toHaveBeenCalled();
});
it('does not claim delivery after provider failure', async () => {
  api.request.mockRejectedValueOnce({ response: { status: 503, data: { code: 'delivery_unavailable' } } });
  const ui = mount(); fireEvent.changeText(ui.getByLabelText('auth.register.email'), 'a@example.test'); fireEvent.press(ui.getByText('auth.emailEntry.sendEmail'));
  await waitFor(() => expect(ui.getByText('auth.emailEntry.deliveryUnavailable')).toBeTruthy());
  expect(ui.queryByLabelText('auth.emailEntry.code')).toBeNull();
});
it('offers recovery when identity is unavailable', async () => {
  api.verify.mockResolvedValue({ next: 'unavailable' }); const ui = mount(); await enterCode(ui);
  fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByText('auth.emailEntry.unavailable')).toBeTruthy());
  fireEvent.press(ui.getByText('auth.emailEntry.usePhone'));
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/appointments' } });
});
it('never persists a late authenticated response after restart and a newer session', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof emailEntryService.verify>>) => void; api.verify.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(api.verify).toHaveBeenCalled()); fireEvent.press(ui.getByText('auth.emailEntry.restart')); mockEpoch++;
  await act(async () => { resolve({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'late', refreshToken: 'late' } }); });
  expect(persistSessionTokensAtEpoch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('redirects registration to the phone-first entry screen preserving continuation', () => {
  mount(<RegisterScreen />);
  expect(mockRedirectHref).toEqual({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/appointments' } });
});

it.each(['register', 'verify_phone'] as const)('completes %s with rotated proof and explicit registration consent', async next => {
  api.verify.mockResolvedValue({ next, email: 'a@example.test', continuationToken: 'email-proof', expiresIn: 600 });
  api.requestPhone.mockResolvedValue({ phoneChallengeId: 'p', continuationToken: 'phone-proof', maskedPhone: '***12', expiresIn: 300, retryAfterSeconds: 60 });
  api.verifyPhone.mockResolvedValue({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'access', refreshToken: 'refresh' } });
  const ui = mount(); await enterCode(ui);
  fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByLabelText('auth.register.phone')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('auth.register.phone'), '0501234567');
  if (next === 'register') {
    fireEvent.changeText(ui.getByLabelText('auth.register.firstName'), 'Sara'); fireEvent.changeText(ui.getByLabelText('auth.register.lastName'), 'Ahmad');
    fireEvent.press(ui.getByText('auth.emailEntry.sendPhone')); expect(api.requestPhone).not.toHaveBeenCalled();
    fireEvent.press(ui.getByRole('checkbox'));
  }
  fireEvent.press(ui.getByText('auth.emailEntry.sendPhone'));
  await waitFor(() => expect(api.requestPhone).toHaveBeenCalledWith(next === 'register' ? { phone: '0501234567', firstName: 'Sara', lastName: 'Ahmad', privacyAccepted: true, continuationToken: 'email-proof' } : { phone: '0501234567', continuationToken: 'email-proof' }));
  await waitFor(() => expect(ui.getByLabelText('auth.emailEntry.code')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '654321'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments'));
  expect(api.verifyPhone).toHaveBeenCalledWith({ phoneChallengeId: 'p', continuationToken: 'phone-proof', code: '654321' });
  expect(persistSessionTokensAtEpoch).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' }, 2);
});
it('returns authenticated email login to the selected booking with its price', async () => {
  mockParams.booking = JSON.stringify({ serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'online', scheduledAt: '2026-10-07T10:00:00Z', amount: '45000', currency: 'SAR' });
  api.verify.mockResolvedValue({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'a', refreshToken: 'r' } });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/confirm', params: { serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'online', scheduledAt: '2026-10-07T10:00:00Z', chargedPrice: '45000', currency: 'SAR' } }));
});
it('expires codes from server time, blocks verification and allows a fresh challenge after cooldown', async () => {
  jest.useFakeTimers();
  try {
    const ui = mount(); await enterCode(ui);
    fireEvent.press(ui.getByText('auth.otp.resend')); expect(api.request).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(301000); });
    expect(ui.getByText('auth.emailEntry.expiredCode')).toBeTruthy();
    fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit')); expect(api.verify).not.toHaveBeenCalled();
    fireEvent.press(ui.getByText('auth.otp.resend')); await waitFor(() => expect(api.request).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(ui.queryByText('auth.emailEntry.expiredCode')).toBeNull());
    ui.unmount(); await act(async () => { jest.runOnlyPendingTimers(); });
  } finally { jest.useRealTimers(); }
});
it.each([
  [503, { statusCode: 503, error: 'SERVICE_UNAVAILABLE', message: 'An unexpected error occurred' }, 'deliveryUnavailable'],
  [429, { statusCode: 429, error: 'TOO_MANY_REQUESTS', code: 'send_limited', retryAfterSeconds: 90 }, 'rateLimited'],
  [400, { statusCode: 400, error: 'BAD_REQUEST', code: 'invalid_or_expired_code' }, 'invalidCode'],
])('handles the real HTTP %s error envelope and recovery', async (status, data, key) => {
  api.verify.mockRejectedValueOnce({ response: { status, data } });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByText(`auth.emailEntry.${key}`)).toBeTruthy());
  expect(ui.getByLabelText('auth.emailEntry.code').props.value).toBe('');
});

it('fences its own incomplete session when cancelled during profile loading', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof authService.getProfile>>) => void;
  jest.mocked(authService.getProfile).mockReturnValueOnce(new Promise(r => { resolve = r; }));
  api.verify.mockResolvedValue({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'a', refreshToken: 'r' } });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(authService.getProfile).toHaveBeenCalled());
  fireEvent.press(ui.getByText('auth.emailEntry.restart'));
  expect(clearSessionAtEpoch).toHaveBeenCalledWith(3);
  await act(async () => { resolve({ success: true, data: { id: 'u', role: 'CLIENT', email: '', name: '', firstName: '', lastName: '', phone: null, gender: null, avatarUrl: null, isActive: true, isSuperAdmin: false, permissions: [] } }); });
  expect(mockReplace).not.toHaveBeenCalled();
});
it('uses the rotated phone proof after resend', async () => {
  jest.useFakeTimers();
  try {
    api.verify.mockResolvedValue({ next: 'verify_phone', email: 'a@example.test', continuationToken: 'email-proof', expiresIn: 600 });
    api.requestPhone.mockResolvedValue({ phoneChallengeId: 'p1', continuationToken: 'proof1', maskedPhone: '***12', expiresIn: 300, retryAfterSeconds: 60 });
    api.resendPhone.mockResolvedValue({ phoneChallengeId: 'p2', continuationToken: 'proof2', maskedPhone: '***12', expiresIn: 300, retryAfterSeconds: 60 });
    api.verifyPhone.mockResolvedValue({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'a', refreshToken: 'r' } });
    const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
    await waitFor(() => expect(ui.getByLabelText('auth.register.phone')).toBeTruthy());
    fireEvent.changeText(ui.getByLabelText('auth.register.phone'), '0501234567'); fireEvent.press(ui.getByText('auth.emailEntry.sendPhone'));
    await waitFor(() => expect(ui.getByLabelText('auth.emailEntry.code')).toBeTruthy());
    await act(async () => { jest.advanceTimersByTime(61000); });
    fireEvent.press(ui.getByText('auth.otp.resend'));
    await waitFor(() => expect(api.resendPhone).toHaveBeenCalledWith({ phoneChallengeId: 'p1', continuationToken: 'proof1' }));
    fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '654321'); fireEvent.press(ui.getByText('auth.otp.submit'));
    await waitFor(() => expect(api.verifyPhone).toHaveBeenCalledWith({ phoneChallengeId: 'p2', continuationToken: 'proof2', code: '654321' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    ui.unmount(); await act(async () => { jest.runOnlyPendingTimers(); });
  } finally { jest.useRealTimers(); }
});
it('starts fresh on remount and rejects an authenticated response after unmount', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof emailEntryService.verify>>) => void;
  api.verify.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(api.verify).toHaveBeenCalled()); ui.unmount();
  const fresh = mount(); expect(fresh.getByLabelText('auth.register.email').props.value).toBe('');
  await act(async () => { resolve({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'late', refreshToken: 'late' } }); });
  expect(persistSessionTokensAtEpoch).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
});

it('rejects malformed phone locally and displays a field-specific error', async () => {
  api.verify.mockResolvedValue({ next: 'verify_phone', email: 'a@example.test', continuationToken: 'proof', expiresIn: 600 });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByLabelText('auth.register.phone')).toBeTruthy());
  for (const phone of ['123', 'not-a-phone', '051234567890']) {
    fireEvent.changeText(ui.getByLabelText('auth.register.phone'), phone);
    expect(ui.getByText('auth.emailEntry.invalidPhone')).toBeTruthy();
    fireEvent.press(ui.getByText('auth.emailEntry.sendPhone'));
    expect(api.requestPhone).not.toHaveBeenCalled();
  }
});
it('bounds each registration name to 100 trimmed characters before sending', async () => {
  api.verify.mockResolvedValue({ next: 'register', email: 'a@example.test', continuationToken: 'proof', expiresIn: 600 });
  api.requestPhone.mockResolvedValueOnce({ phoneChallengeId: 'p', continuationToken: 'phone-proof', maskedPhone: '***12', expiresIn: 300, retryAfterSeconds: 60 });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByLabelText('auth.register.phone')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('auth.register.phone'), '0501234567');
  fireEvent.changeText(ui.getByLabelText('auth.register.firstName'), 'A'.repeat(101));
  fireEvent.changeText(ui.getByLabelText('auth.register.lastName'), 'B'); fireEvent.press(ui.getByRole('checkbox'));
  expect(ui.getByText('auth.emailEntry.nameTooLong')).toBeTruthy();
  fireEvent.press(ui.getByText('auth.emailEntry.sendPhone')); expect(api.requestPhone).not.toHaveBeenCalled();
  fireEvent.changeText(ui.getByLabelText('auth.register.firstName'), 'A');
  fireEvent.changeText(ui.getByLabelText('auth.register.lastName'), 'B'.repeat(101));
  expect(ui.getByText('auth.emailEntry.nameTooLong')).toBeTruthy();
  fireEvent.press(ui.getByText('auth.emailEntry.sendPhone')); expect(api.requestPhone).not.toHaveBeenCalled();
  fireEvent.changeText(ui.getByLabelText('auth.register.lastName'), '  ' + 'B'.repeat(100) + '  ');
  fireEvent.press(ui.getByText('auth.emailEntry.sendPhone'));
  await waitFor(() => expect(api.requestPhone).toHaveBeenCalledWith({ phone: '0501234567', firstName: 'A', lastName: 'B'.repeat(100), privacyAccepted: true, continuationToken: 'proof' }));
  await waitFor(() => expect(ui.getByLabelText('auth.emailEntry.code')).toBeTruthy());
});
it('preserves international phone entry and maps a backend invalid_phone rejection safely', async () => {
  api.verify.mockResolvedValue({ next: 'verify_phone', email: 'a@example.test', continuationToken: 'proof', expiresIn: 600 });
  api.requestPhone.mockRejectedValueOnce({ response: { status: 400, data: { statusCode: 400, error: 'BAD_REQUEST', message: 'invalid_phone' } } });
  const ui = mount(); await enterCode(ui); fireEvent.changeText(ui.getByLabelText('auth.emailEntry.code'), '123456'); fireEvent.press(ui.getByText('auth.otp.submit'));
  await waitFor(() => expect(ui.getByLabelText('auth.register.phone')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('auth.register.phone'), '+1 (415) 555-0100'); fireEvent.press(ui.getByText('auth.emailEntry.sendPhone'));
  await waitFor(() => expect(api.requestPhone).toHaveBeenCalledWith({ phone: '+1 (415) 555-0100', continuationToken: 'proof' }));
  await waitFor(() => expect(ui.getByText('auth.emailEntry.invalidPhone')).toBeTruthy());
  expect(ui.queryByText('invalid_phone')).toBeNull(); expect(ui.queryByText('auth.emailEntry.networkError')).toBeNull();
});

it('prefills phone recovery and carries its identifier and booking continuation to verification', async () => {
  mockParams = { identifier: '0501234567', redirect: '/(client)/(tabs)/appointments' };
  const ui = mount(<ForgotPasswordScreen />);
  expect(ui.getByLabelText('auth.login.identifier').props.value).toBe('0501234567');
  await act(async () => { fireEvent.press(ui.getByText('auth.forgotPassword.submit')); });
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/reset-password', params: { identifier: '0501234567', redirect: '/(client)/(tabs)/appointments' } }));
  expect(authService.requestPasswordResetOtp).toHaveBeenCalledWith('0501234567');
});
it('sets a password only after OTP verification and enforces the server password policy', async () => {
  mockParams = { identifier: '0501234567', redirect: '/(client)/(tabs)/appointments' };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const ui = mount(<ResetPasswordScreen />);
  fireEvent.changeText(ui.getByLabelText('auth.resetPassword.codeLabel'), '1234');
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'auth.resetPassword.verifyCode' })); });
  await waitFor(() => expect(ui.getByLabelText('auth.resetPassword.newPasswordLabel')).toBeTruthy());
  expect(authService.verifyPasswordResetOtp).toHaveBeenCalledWith('0501234567', '1234');
  for (const value of ['longenough', 'Uppercase', 'lower123', 'A1' + 'a'.repeat(199)]) {
    fireEvent.changeText(ui.getByLabelText('auth.resetPassword.newPasswordLabel'), value);
    fireEvent.changeText(ui.getByLabelText('auth.confirmPassword'), value);
    await act(async () => { fireEvent.press(ui.getByText('auth.resetPassword.submit')); });
    expect(ui.getByText('auth.resetPassword.weakPassword')).toBeTruthy();
  }
  expect(authService.resetClientPassword).not.toHaveBeenCalled();
  fireEvent.changeText(ui.getByLabelText('auth.resetPassword.newPasswordLabel'), 'SafePassword1');
  fireEvent.changeText(ui.getByLabelText('auth.confirmPassword'), 'SafePassword1');
  await act(async () => { fireEvent.press(ui.getByText('auth.resetPassword.submit')); });
  await waitFor(() => expect(authService.resetClientPassword).toHaveBeenCalledWith('verified-proof', 'SafePassword1'));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  alert.mock.calls.at(-1)?.[2]?.[0]?.onPress?.();
  expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/appointments' } });
  alert.mockRestore();
});

it.each(['123', '12345', '123456', '12a4'])('rejects invalid recovery code %s before verification', async code => {
  mockParams = { identifier: '0501234567' };
  const ui = mount(<ResetPasswordScreen />);
  const input = ui.getByLabelText('auth.resetPassword.codeLabel');
  fireEvent.changeText(input, code);
  await act(async () => { fireEvent.press(ui.getByRole('button', { name: 'auth.resetPassword.verifyCode' })); });
  expect(ui.getByText('auth.resetPassword.invalidCode')).toBeTruthy();
  expect(authService.verifyPasswordResetOtp).not.toHaveBeenCalled();
});
it('limits the recovery code field to the four-digit public OTP contract', () => {
  const ui = mount(<ResetPasswordScreen />);
  expect(ui.getByLabelText('auth.resetPassword.codeLabel').props.maxLength).toBe(4);
});
