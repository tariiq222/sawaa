import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { phoneEntryService, type PhoneCompletion } from '@/services/phone-entry';
import { persistSessionTokensAtEpoch } from '@/services/native-session-state';

const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn(); let mockEpoch = 1;
let mockParams: Record<string, string> = { redirect: '/(client)/(tabs)/appointments' };
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack, push: mockPush }), useLocalSearchParams: () => mockParams, useFocusEffect: jest.fn() }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), impactAsync: jest.fn(), NotificationFeedbackType: { Success: 'success', Error: 'error' }, ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('@/services/phone-entry', () => ({ phoneEntryError: jest.requireActual('@/services/phone-entry').phoneEntryError, phoneEntryService: { request: jest.fn(), resend: jest.fn(), verify: jest.fn(), complete: jest.fn() } }));
jest.mock('@/hooks/use-redux', () => ({ useAppDispatch: () => jest.fn() }));
jest.mock('@/services/native-session-state', () => ({ getSessionEpoch: () => mockEpoch, isSessionCurrent: (e: number) => e === mockEpoch, beginSession: () => ++mockEpoch, fenceSession: () => ++mockEpoch, clearSessionAtEpoch: jest.fn().mockResolvedValue(true), persistSessionTokensAtEpoch: jest.fn().mockResolvedValue(true) }));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn().mockResolvedValue({ success: true, data: { id: 'u', role: 'CLIENT' } }) }, SessionSupersededError: class extends Error {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: { colors: { surface: '#FFF', surfaceHigh: '#EEE', textPrimary: '#000', textSecondary: '#666', textMuted: '#999', primary: '#098a7d', primaryFill: '#087a6f', primaryGradient: ['#087a6f', '#066962'], primaryForeground: '#FFF', error: '#B3261E', success: '#1B7F4C', warning: '#9A6B15' }, typography: { fontFamily: { arabic: 'System', english: 'System' } } }, isRTL: false, language: 'en' }) }));

import LoginScreen from '../(auth)/login';

const api = jest.mocked(phoneEntryService);
const challenge = { challengeId: 'c1', maskedPhone: '••• ••12', expiresIn: 300 as const, retryAfterSeconds: 60 as const };
const authenticated: PhoneCompletion = { next: 'authenticated', emailPrompt: false, sessionKind: 'client', tokens: { accessToken: 'access', refreshToken: 'refresh' } };
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  return { client, ui: render(<QueryClientProvider client={client}><LoginScreen /></QueryClientProvider>) };
}
async function requestCode(ui: ReturnType<typeof mount>['ui']) {
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.phoneLabel'), '0501234567');
  fireEvent.press(ui.getByText('auth.phoneEntry.continue'));
  await waitFor(() => expect(ui.getByLabelText('auth.phoneEntry.codeLabel')).toBeTruthy());
}
beforeAll(() => { notifyManager.setNotifyFunction(callback => { act(callback); }); });
afterAll(() => { notifyManager.setNotifyFunction(callback => callback()); });
beforeEach(() => { jest.clearAllMocks(); mockEpoch = 1; mockParams = { redirect: '/(client)/(tabs)/appointments' }; api.request.mockResolvedValue(challenge); });

it('sends the normalized Saudi phone and completes an authenticated login with its redirect continuation', async () => {
  api.verify.mockResolvedValue(authenticated);
  const { ui } = mount(); await requestCode(ui);
  expect(api.request).toHaveBeenCalledWith({ phone: '+966501234567' });
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.codeLabel'), '123456');
  fireEvent.press(ui.getByText('auth.phoneEntry.confirm'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments'));
  expect(api.verify).toHaveBeenCalledWith({ challengeId: 'c1', code: '123456' });
  expect(persistSessionTokensAtEpoch).toHaveBeenCalledWith({ accessToken: 'access', refreshToken: 'refresh' }, 2);
});
it('returns a phone login to the selected booking with its price', async () => {
  mockParams.booking = JSON.stringify({ serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'online', scheduledAt: '2026-10-07T10:00:00Z', amount: '45000', currency: 'SAR' });
  api.verify.mockResolvedValue(authenticated);
  const { ui } = mount(); await requestCode(ui);
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.codeLabel'), '123456'); fireEvent.press(ui.getByText('auth.phoneEntry.confirm'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/(client)/booking/confirm', params: { serviceId: 's', employeeId: 'e', branchId: 'b', deliveryType: 'online', scheduledAt: '2026-10-07T10:00:00Z', chargedPrice: '45000', currency: 'SAR' } }));
});
it('registers a new number through the details step with consent and an optional email', async () => {
  api.verify.mockResolvedValue({ next: 'register', continuationToken: 'secret', expiresIn: 600 });
  api.complete.mockResolvedValue(authenticated);
  const { ui } = mount(); await requestCode(ui);
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.codeLabel'), '123456'); fireEvent.press(ui.getByText('auth.phoneEntry.confirm'));
  await waitFor(() => expect(ui.getByLabelText('auth.register.firstName')).toBeTruthy());
  fireEvent.press(ui.getByText('auth.phoneEntry.createAccount'));
  expect(api.complete).not.toHaveBeenCalled();
  fireEvent.changeText(ui.getByLabelText('auth.register.firstName'), 'Sara');
  fireEvent.changeText(ui.getByLabelText('auth.register.lastName'), 'Ahmad');
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.emailOptional'), 'sara@example.test');
  fireEvent.press(ui.getByRole('checkbox'));
  fireEvent.press(ui.getByText('auth.phoneEntry.createAccount'));
  await waitFor(() => expect(api.complete).toHaveBeenCalledWith({ continuationToken: 'secret', firstName: 'Sara', lastName: 'Ahmad', email: 'sara@example.test', privacyAccepted: true }));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments'));
});
it('shows a contact-the-center message for unavailable numbers', async () => {
  api.verify.mockResolvedValue({ next: 'unavailable' });
  const { ui } = mount(); await requestCode(ui);
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.codeLabel'), '123456'); fireEvent.press(ui.getByText('auth.phoneEntry.confirm'));
  await waitFor(() => expect(ui.getByText('auth.phoneEntry.unavailable')).toBeTruthy());
});
it('rejects a non-Saudi number locally before any request', () => {
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.phoneLabel'), '+14155550100');
  fireEvent.press(ui.getByText('auth.phoneEntry.continue'));
  expect(ui.getByText('auth.phoneEntry.invalidPhone')).toBeTruthy();
  expect(api.request).not.toHaveBeenCalled();
});
it('maps a backend invalid_phone rejection to the safe Saudi-only message', async () => {
  api.request.mockRejectedValueOnce({ response: { status: 400, data: { code: 'invalid_phone' } } });
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('auth.phoneEntry.phoneLabel'), '0501234567');
  fireEvent.press(ui.getByText('auth.phoneEntry.continue'));
  await waitFor(() => expect(ui.getByText('auth.phoneEntry.invalidPhone')).toBeTruthy());
  expect(ui.queryByText('invalid_phone')).toBeNull();
});
it('preserves booking and redirect params on the email-entry and staff links', () => {
  const { ui } = mount();
  fireEvent.press(ui.getByText('auth.phoneEntry.emailLoginLink'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/email-entry', params: { redirect: '/(client)/(tabs)/appointments' } });
  expect(ui.queryByText('auth.phoneEntry.staffLoginLink')).toBeNull();
});
it('keeps the code challenge secret out of route parameters', async () => {
  api.verify.mockResolvedValue(authenticated);
  const { ui } = mount(); await requestCode(ui);
  expect(mockPush).not.toHaveBeenCalled();
  expect(ui.queryByText('c1')).toBeNull();
});
