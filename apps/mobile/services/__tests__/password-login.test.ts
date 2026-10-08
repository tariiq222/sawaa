jest.mock('../api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
  },
}));
const mockUnregisterPushAsync = jest.fn().mockResolvedValue(undefined);
jest.mock('../push', () => ({ unregisterPushAsync: (...a: unknown[]) => mockUnregisterPushAsync(...a) }));

const mockGetSecureItem = jest.fn();
const mockSetSecureItem = jest.fn();
const mockDeleteSecureItem = jest.fn();
jest.mock('@/stores/secure-storage', () => ({
  getSecureItem: (...a: unknown[]) => mockGetSecureItem(...a),
  setSecureItem: (...a: unknown[]) => mockSetSecureItem(...a),
  deleteSecureItem: (...a: unknown[]) => mockDeleteSecureItem(...a),
}));

const mockDispatch = jest.fn();
jest.mock('@/stores/store', () => ({ store: { dispatch: (...a: unknown[]) => mockDispatch(...a) } }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn(() => ({ type: 'auth/logout' })) }));

import api from '../api';
import { authService, SessionSupersededError } from '../auth';
import * as nativeSessionState from '../native-session-state';

const mockedApi = api as unknown as { post: jest.Mock; get: jest.Mock; delete: jest.Mock };

import { loginWithPassword } from '../password-login';

beforeEach(() => jest.clearAllMocks());
const response = { sessionKind: 'client', tokens: { accessToken: 'access', refreshToken: 'refresh' } };
it.each([[' Sara@Example.test ', { email: 'sara@example.test', password: 'Secret1' }], [' 0501234567 ', { phone: '0501234567', password: 'Secret1' }]])('uses the customer endpoint for %s and stores only tokens', async (identifier, payload) => {
  mockedApi.post.mockResolvedValueOnce({ data: response });
  const result = await loginWithPassword(identifier as string, 'Secret1');
  expect(mockedApi.post).toHaveBeenCalledWith('/mobile/auth/password-login', payload);
  expect(result.sessionKind).toBe('client');
  expect(nativeSessionState.isSessionCurrent(result.sessionEpoch)).toBe(true);
  expect(mockSetSecureItem.mock.calls).toEqual([['accessToken', 'access'], ['refreshToken', 'refresh']]);
});
it.each([null, {}, { ...response, sessionKind: 'staff' }, { ...response, tokens: { accessToken: 1, refreshToken: 'r' } }])('rejects invalid or staff response %p before storage', async data => {
  mockedApi.post.mockResolvedValueOnce({ data });
  await expect(loginWithPassword('a@b.test', 'Secret1')).rejects.toThrow();
  expect(mockSetSecureItem).not.toHaveBeenCalled();
});
it('fences a late response after a newer login', async () => {
  let resolve!: (value: unknown) => void;
  mockedApi.post.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const pending = loginWithPassword('a@b.test', 'Secret1');
  nativeSessionState.beginSession(); resolve({ data: response });
  await expect(pending).rejects.toBeInstanceOf(SessionSupersededError);
  expect(mockSetSecureItem).not.toHaveBeenCalled();
});
it('hands off the owned epoch before the request for navigation cancellation', async () => {
  const started = jest.fn(epoch => { expect(nativeSessionState.isSessionCurrent(epoch)).toBe(true); });
  mockedApi.post.mockResolvedValueOnce({ data: response });
  await loginWithPassword('a@b.test', 'Secret1', started);
  expect(started).toHaveBeenCalledTimes(1);
});
it.each(['a@b.test', '0501234567'])('uses verified recovery purpose for %s', async identifier => {
  mockedApi.post.mockResolvedValue({ data: { sessionToken: 'proof' } });
  await authService.requestPasswordResetOtp(identifier);
  await authService.verifyPasswordResetOtp(identifier, '123456');
  const channel = identifier.includes('@') ? 'EMAIL' : 'SMS';
  expect(mockedApi.post).toHaveBeenNthCalledWith(1, '/public/otp/request', { identifier, channel, purpose: 'CLIENT_PASSWORD_RESET' });
  expect(mockedApi.post).toHaveBeenNthCalledWith(2, '/public/otp/verify', { identifier, channel, purpose: 'CLIENT_PASSWORD_RESET', code: '123456' });
});

it('rejects superseded persistence and propagates unauthorized without storing a password', async () => {
  mockedApi.post.mockResolvedValueOnce({ data: response });
  const persist = jest.spyOn(nativeSessionState, 'persistSessionTokensAtEpoch').mockResolvedValueOnce(false);
  await expect(loginWithPassword('a@b.test', 'Secret1')).rejects.toBeInstanceOf(SessionSupersededError);
  persist.mockRestore();
  mockedApi.post.mockRejectedValueOnce(new Error('401'));
  await expect(loginWithPassword('a@b.test', 'Secret1')).rejects.toThrow('401');
  expect(mockSetSecureItem).not.toHaveBeenCalled();
});
