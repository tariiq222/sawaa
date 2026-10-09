import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';

let mockParams: Record<string, string> = {};
const mockPush = jest.fn(); const mockReplace = jest.fn(); const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: jest.fn(),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' }, NotificationFeedbackType: { Success: 'success', Error: 'error' } }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/features/settings/SettingsScaffold', () => ({
  SettingsScaffold: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: { colors: { error: '#B3261E', primary: '#098a7d', textMuted: '#999' } }, isRTL: false, language: 'en' }) }));
jest.mock('@/services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/services/client-email', () => ({
  clientEmailError: jest.requireActual('@/services/client-email').clientEmailError,
  clientEmailService: { getStatus: jest.fn(), request: jest.fn(), verify: jest.fn(), decline: jest.fn() },
}));

const mockStatusData = { data: { status: 'unverified' as string, email: null as string | null, pendingEmail: null as string | null, prompt: true } };
const mockRequest = jest.fn(); const mockVerify = jest.fn(); const mockDecline = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useClientEmailStatus: () => ({ data: mockStatusData.data }),
  useRequestClientEmail: () => ({ mutateAsync: mockRequest, isPending: false }),
  useVerifyClientEmail: () => ({ mutateAsync: mockVerify, isPending: false }),
  useDeclineClientEmail: () => ({ mutateAsync: mockDecline, isPending: false }),
}));

import EmailVerifyScreen from '../(client)/email-verify';
import { isClientEmailPromptSnoozed, resetClientEmailPromptStateForTests } from '@/features/auth/client-email-prompt';

const challenge = { challengeId: 'ch', maskedEmail: 'a***@example.test', expiresIn: 300 as const, retryAfterSeconds: 60 as const };
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  const ui = render(<QueryClientProvider client={client}><EmailVerifyScreen /></QueryClientProvider>);
  return { client, ui };
}
beforeAll(() => { notifyManager.setNotifyFunction(callback => { act(callback); }); });
afterAll(() => { notifyManager.setNotifyFunction(callback => callback()); });
beforeEach(() => {
  jest.clearAllMocks(); mockParams = {}; resetClientEmailPromptStateForTests();
  mockStatusData.data = { status: 'unverified', email: null, pendingEmail: null, prompt: true };
  mockRequest.mockResolvedValue(challenge);
  mockVerify.mockResolvedValue({ status: 'verified', email: 'a@example.test', pendingEmail: null, prompt: false });
  mockDecline.mockResolvedValue({ status: 'none', email: null, pendingEmail: null, prompt: false });
});

it('prompt mode offers decline and later; manage mode does not', () => {
  mockParams = { mode: 'prompt' };
  const prompt = mount().ui;
  expect(prompt.getByText('profile.email.decline')).toBeTruthy();
  expect(prompt.getByText('profile.email.later')).toBeTruthy();
  mockParams = { mode: 'manage' };
  const manage = mount().ui;
  expect(manage.queryByText('profile.email.decline')).toBeNull();
  expect(manage.queryByText('profile.email.later')).toBeNull();
});
it('never prefills a legacy unverified email, only a pending one', () => {
  mockStatusData.data = { status: 'unverified', email: null, pendingEmail: null, prompt: true };
  const legacy = mount().ui;
  expect(legacy.getByLabelText('profile.email.label').props.value).toBe('');
  mockStatusData.data = { status: 'pending', email: null, pendingEmail: 'pending@example.test', prompt: true };
  const pending = mount().ui;
  expect(pending.getByLabelText('profile.email.label').props.value).toBe('pending@example.test');
});
it('declines the prompt through the API and leaves the screen', async () => {
  mockParams = { mode: 'prompt' };
  const { ui } = mount();
  fireEvent.press(ui.getByText('profile.email.decline'));
  await waitFor(() => expect(mockDecline).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
});
it('later snoozes the prompt for this app session without calling the server', () => {
  mockParams = { mode: 'prompt' };
  const { ui } = mount();
  fireEvent.press(ui.getByText('profile.email.later'));
  expect(mockBack).toHaveBeenCalledTimes(1);
  expect(mockDecline).not.toHaveBeenCalled();
  expect(isClientEmailPromptSnoozed()).toBe(true);
});
it('confirms the code with the in-memory challenge and announces success', async () => {
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.email.label'), 'a@example.test');
  fireEvent.press(ui.getByText('profile.email.sendCode'));
  await waitFor(() => expect(mockRequest).toHaveBeenCalledWith({ email: 'a@example.test' }));
  await waitFor(() => expect(ui.getByLabelText('profile.email.codeLabel')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('profile.email.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.email.confirm'));
  await waitFor(() => expect(mockVerify).toHaveBeenCalledWith({ challengeId: 'ch', code: '123456' }));
  await waitFor(() => expect(ui.getByText('profile.email.verified')).toBeTruthy());
});
it('maps an invalid code to the safe message without server text', async () => {
  mockVerify.mockRejectedValueOnce({ response: { status: 400, data: { code: 'invalid_or_expired_code', message: 'provider detail' } } });
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.email.label'), 'a@example.test');
  fireEvent.press(ui.getByText('profile.email.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.email.codeLabel')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('profile.email.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.email.confirm'));
  await waitFor(() => expect(ui.getByText('profile.email.invalidCode')).toBeTruthy());
  expect(ui.queryByText('provider detail')).toBeNull();
  expect(ui.getByLabelText('profile.email.codeLabel').props.value).toBe('');
});
