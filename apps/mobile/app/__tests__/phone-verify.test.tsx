import React from 'react';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider, notifyManager } from '@tanstack/react-query';
import type { User } from '@/types/auth';

const mockPush = jest.fn(); const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => ({}),
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
jest.mock('@/services/client-phone', () => ({
  clientPhoneError: jest.requireActual('@/services/client-phone').clientPhoneError,
  clientPhoneService: { request: jest.fn(), verify: jest.fn() },
}));

const baseUser: User = {
  id: 'client-1', name: 'Sara', firstName: 'Sara', lastName: '',
  email: 'sara@example.com', phone: '+966501234567', gender: null, avatarUrl: null,
  isActive: true, role: 'CLIENT', isSuperAdmin: false, permissions: [],
};
let mockUser: User = { ...baseUser };
const mockDispatch = jest.fn();
jest.mock('@/hooks/use-redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (select: (state: { auth: { user: User | null } }) => unknown) => select({ auth: { user: mockUser } }),
}));
jest.mock('@/stores/slices/auth-slice', () => ({
  setToken: (payload: string) => ({ type: 'auth/setToken', payload }),
  setUser: (payload: User) => ({ type: 'auth/setUser', payload }),
}));

const mockRequest = jest.fn(); const mockVerify = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useRequestClientPhone: () => ({ mutateAsync: mockRequest, isPending: false }),
  useVerifyClientPhone: () => ({ mutateAsync: mockVerify, isPending: false }),
}));

jest.mock('@/hooks/queries/useClientProfile', () => ({ clientProfileKeys: { all: ['client', 'profile'] } }));

const mockPersist = jest.fn();
let mockSessionCurrent = true;
jest.mock('@/services/native-session-state', () => ({
  getSessionEpoch: () => 1,
  isSessionCurrent: () => mockSessionCurrent,
  persistSessionTokensAtEpoch: (tokens: unknown, epoch: number) => mockPersist(tokens, epoch),
}));

import PhoneVerifyScreen from '../(client)/phone-verify';

const challenge = { challengeId: 'ch', maskedPhone: '+96650***4567', expiresIn: 300 as const, retryAfterSeconds: 60 as const };
const verification = { phone: '+966509876543', tokens: { accessToken: 'a-2', refreshToken: 'r-2' } };
function mount() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: 0 } } });
  const ui = render(<QueryClientProvider client={client}><PhoneVerifyScreen /></QueryClientProvider>);
  return { client, ui };
}
beforeAll(() => { notifyManager.setNotifyFunction(callback => { act(callback); }); });
afterAll(() => { notifyManager.setNotifyFunction(callback => callback()); });
beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { ...baseUser };
  mockSessionCurrent = true;
  mockRequest.mockResolvedValue(challenge);
  mockVerify.mockResolvedValue(verification);
  mockPersist.mockResolvedValue(true);
});

it('normalizes the Saudi entry form before requesting the code', async () => {
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0501234567');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(mockRequest).toHaveBeenCalledWith({ phone: '+966501234567' }));
});
it('blocks a non-Saudi number locally without calling the server', () => {
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '+14155550100');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  expect(mockRequest).not.toHaveBeenCalled();
  expect(ui.getByText('profile.phone.invalidPhone')).toBeTruthy();
});
it('refreshes cached profile reads only after the rotated tokens are stored', async () => {
  const { ui, client } = mount();
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.phone.codeLabel')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('profile.phone.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.phone.confirm'));
  await waitFor(() => expect(invalidate).toHaveBeenCalled());
  expect(mockPersist.mock.invocationCallOrder[0]).toBeLessThan(invalidate.mock.invocationCallOrder[0]);
});
it('stores the fresh tokens epoch-fenced and updates token and user on success', async () => {
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.phone.codeLabel')).toBeTruthy());
  expect(ui.getByText('profile.phone.codeSentTo')).toBeTruthy();
  fireEvent.changeText(ui.getByLabelText('profile.phone.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.phone.confirm'));
  await waitFor(() => expect(mockVerify).toHaveBeenCalledWith({ challengeId: 'ch', code: '123456' }));
  await waitFor(() => expect(ui.getByText('profile.phone.changed')).toBeTruthy());
  expect(mockPersist).toHaveBeenCalledWith(verification.tokens, 1);
  expect(mockDispatch).toHaveBeenCalledWith({ type: 'auth/setToken', payload: 'a-2' });
  const setUserCall = mockDispatch.mock.calls.find(call => call[0]?.type === 'auth/setUser');
  expect(setUserCall?.[0].payload).toMatchObject({ id: 'client-1', phone: '+966509876543' });
});
it('does not persist tokens or touch redux when the session epoch changed meanwhile', async () => {
  mockSessionCurrent = false;
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.phone.codeLabel')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('profile.phone.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.phone.confirm'));
  await waitFor(() => expect(mockVerify).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  expect(mockPersist).not.toHaveBeenCalled();
  expect(mockDispatch).not.toHaveBeenCalled();
  expect(ui.queryByText('profile.phone.changed')).toBeNull();
});
it('maps server error codes to safe messages without rendering server text', async () => {
  mockRequest.mockRejectedValueOnce({ response: { status: 400, data: { code: 'phone_unchanged', message: 'server detail' } } });
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByText('profile.phone.unchangedPhone')).toBeTruthy());
  expect(ui.queryByText('server detail')).toBeNull();
});
it('maps an invalid code to the safe message and clears the entry', async () => {
  mockVerify.mockRejectedValueOnce({ response: { status: 400, data: { code: 'invalid_or_expired_code', message: 'provider detail' } } });
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.phone.codeLabel')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('profile.phone.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.phone.confirm'));
  await waitFor(() => expect(ui.getByText('profile.phone.invalidCode')).toBeTruthy());
  expect(ui.queryByText('provider detail')).toBeNull();
  expect(ui.getByLabelText('profile.phone.codeLabel').props.value).toBe('');
  expect(mockPersist).not.toHaveBeenCalled();
});
it('maps details_unavailable on verify without persisting tokens', async () => {
  mockVerify.mockRejectedValueOnce({ response: { status: 409, data: { code: 'details_unavailable' } } });
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.phone.codeLabel')).toBeTruthy());
  fireEvent.changeText(ui.getByLabelText('profile.phone.codeLabel'), '123456');
  fireEvent.press(ui.getByText('profile.phone.confirm'));
  await waitFor(() => expect(ui.getByText('profile.phone.detailsUnavailable')).toBeTruthy());
  expect(mockPersist).not.toHaveBeenCalled();
});
it('applies the server retry window when send_limited is returned', async () => {
  mockRequest.mockRejectedValueOnce({ response: { status: 429, data: { code: 'send_limited', retryAfterSeconds: 120 } } });
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByText('profile.phone.sendLimited')).toBeTruthy());
});
it('offers editing the number again from the code step', async () => {
  const { ui } = mount();
  fireEvent.changeText(ui.getByLabelText('profile.phone.newPhoneLabel'), '0509876543');
  fireEvent.press(ui.getByText('profile.phone.sendCode'));
  await waitFor(() => expect(ui.getByLabelText('profile.phone.codeLabel')).toBeTruthy());
  fireEvent.press(ui.getByText('profile.phone.editPhone'));
  expect(ui.getByLabelText('profile.phone.newPhoneLabel').props.value).toBe('0509876543');
  expect(ui.queryByLabelText('profile.phone.codeLabel')).toBeNull();
});
