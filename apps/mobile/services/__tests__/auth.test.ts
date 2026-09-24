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
import { authService, SessionSupersededError, verifyMobileOtp, loginReviewAccount } from '../auth';
import * as nativeSessionState from '../native-session-state';
import type { User } from '@/types/auth';

const mockedApi = api as unknown as { post: jest.Mock; get: jest.Mock; delete: jest.Mock };

// Deprecated multi-tenant contract fields are intentionally omitted; the
// double assertion keeps the fixture compiling while the API contract sheds
// them in a staged cleanup.
const baseUser = {
  id: 'u1',
  email: 'a@b.c',
  name: 'A B',
  firstName: 'A',
  lastName: 'B',
  phone: null,
  gender: null,
  avatarUrl: null,
  isActive: true,
  role: 'CLIENT',
  customRoleId: null,
  isSuperAdmin: false,
  permissions: [],
  onboardingCompletedAt: null,
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00Z',
} as unknown as User;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authService.login', () => {
  it('persists tokens on bare backend response', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        expiresIn: 1200,
        user: baseUser,
      },
    });

    const res = await authService.login({ email: 'a@b.c', password: 'p' });

    expect(res.success).toBe(true);
    expect(res.data?.accessToken).toBe('access-1');
    expect(mockSetSecureItem).toHaveBeenCalledWith('accessToken', 'access-1');
    expect(mockSetSecureItem).toHaveBeenCalledWith('refreshToken', 'refresh-1');
  });

  it('passes through legacy { success, data } envelope', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: { accessToken: 'a', refreshToken: 'r', expiresIn: 900, user: baseUser },
      },
    });
    const res = await authService.login({ email: 'a@b.c', password: 'p' });
    expect(res.success).toBe(true);
    expect(mockSetSecureItem).toHaveBeenCalled();
  });

  it('returns success:false when response is malformed', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { foo: 'bar' } });
    const res = await authService.login({ email: 'a@b.c', password: 'p' });
    expect(res.success).toBe(false);
    expect(mockSetSecureItem).not.toHaveBeenCalled();
  });

  it('propagates API errors (e.g. 401 invalid credentials)', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('Request failed with status code 401'));
    await expect(authService.login({ email: 'x', password: 'y' })).rejects.toThrow(/401/);
  });
});

describe('authService.register', () => {
  it('persists tokens on success', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { accessToken: 'a', refreshToken: 'r', user: baseUser },
    });
    const res = await authService.register({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.c',
      password: 'pw',
    });
    expect(res.success).toBe(true);
    expect(mockSetSecureItem).toHaveBeenCalledTimes(2);
  });
});

describe('authService.sendOtp / verifyOtp', () => {
  it('sendOtp returns response payload as-is', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { success: true } });
    const r = await authService.sendOtp({ email: 'a@b.c' });
    expect(r).toEqual({ success: true });
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login/otp/send', { email: 'a@b.c' });
  });

  it('verifyOtp persists tokens when valid', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { accessToken: 'a', refreshToken: 'r', user: baseUser },
    });
    const res = await authService.verifyOtp({ email: 'a@b.c', code: '1234' });
    expect(res.success).toBe(true);
    expect(mockSetSecureItem).toHaveBeenCalledWith('accessToken', 'a');
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login/otp/verify', {
      email: 'a@b.c',
      code: '1234',
    });
  });

  it('verifyOtp surfaces invalid-code errors (HTTP 400)', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('Invalid code'));
    await expect(
      authService.verifyOtp({ email: 'a@b.c', code: '0000' }),
    ).rejects.toThrow(/Invalid code/);
  });

  it('rejects a successful mobile OTP when its session persistence was superseded', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: { tokens: { accessToken: 'stale-access', refreshToken: 'stale-refresh' } },
    });
    const persistSpy = jest
      .spyOn(nativeSessionState, 'persistSessionTokensAtEpoch')
      .mockResolvedValue(false);

    try {
      await expect(
        verifyMobileOtp({ identifier: 'a@b.c', code: '1234', purpose: 'login' }),
      ).rejects.toBeInstanceOf(SessionSupersededError);
    } finally {
      persistSpy.mockRestore();
    }
    expect(mockSetSecureItem).not.toHaveBeenCalledWith('accessToken', 'stale-access');
  });
});

describe('authService.requestAccountDeletion', () => {
  it('closes once and clears the current session after server confirmation', async () => {
    mockedApi.delete.mockResolvedValueOnce({ data: { status: 'closed' } });

    const first = authService.requestAccountDeletion();
    const second = authService.requestAccountDeletion();
    await Promise.all([first, second]);

    expect(mockedApi.delete).toHaveBeenCalledTimes(1);
    expect(mockedApi.delete).toHaveBeenCalledWith('/mobile/client/profile');
    expect(mockDeleteSecureItem).toHaveBeenCalledWith('accessToken');
    expect(mockDeleteSecureItem).toHaveBeenCalledWith('refreshToken');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('keeps the local session when closure fails or is not confirmed', async () => {
    mockedApi.delete.mockRejectedValueOnce(new Error('401'));
    await expect(authService.requestAccountDeletion()).rejects.toThrow('401');
    mockedApi.delete.mockResolvedValueOnce({ data: { status: 'scheduled' } });
    await expect(authService.requestAccountDeletion()).rejects.toThrow('not confirmed');
    expect(mockDeleteSecureItem).not.toHaveBeenCalled();
  });

  it('does not clear a newer login that completed while closure was pending', async () => {
    let completeClosure: ((value: { data: { status: string } }) => void) | undefined;
    mockedApi.delete.mockReturnValueOnce(new Promise((resolve) => { completeClosure = resolve; }));

    const closure = authService.requestAccountDeletion();
    nativeSessionState.beginSession();
    completeClosure?.({ data: { status: 'closed' } });
    await closure;

    expect(mockDeleteSecureItem).not.toHaveBeenCalled();
  });

  it('lets a newer session submit its own closure while the old request is pending', async () => {
    let completeOld: ((value: { data: { status: string } }) => void) | undefined;
    mockedApi.delete.mockReturnValueOnce(new Promise((resolve) => { completeOld = resolve; }));
    mockedApi.delete.mockResolvedValueOnce({ data: { status: 'closed' } });

    const oldClosure = authService.requestAccountDeletion();
    nativeSessionState.beginSession();
    const newClosure = authService.requestAccountDeletion();
    await newClosure;
    completeOld?.({ data: { status: 'closed' } });
    await oldClosure;

    expect(mockedApi.delete).toHaveBeenCalledTimes(2);
    expect(mockDeleteSecureItem).toHaveBeenCalledTimes(2);
  });
});

describe('authService.logout', () => {
  it('hits the native logout endpoint, clears storage + redux', async () => {
    mockGetSecureItem.mockResolvedValueOnce('refresh-token-xyz');
    mockedApi.post.mockResolvedValueOnce({ data: {} });

    await authService.logout();

    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/auth/logout', {
      refreshToken: 'refresh-token-xyz',
    });
    expect(mockUnregisterPushAsync).toHaveBeenCalledTimes(1);
    expect(mockDeleteSecureItem).toHaveBeenCalledWith('accessToken');
    expect(mockDeleteSecureItem).toHaveBeenCalledWith('refreshToken');
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('still clears local state when backend logout call rejects', async () => {
    mockGetSecureItem.mockResolvedValueOnce('rt');
    mockedApi.post.mockRejectedValueOnce(new Error('500'));

    await authService.logout();

    expect(mockDeleteSecureItem).toHaveBeenCalledWith('accessToken');
    expect(mockDispatch).toHaveBeenCalled();
  });

  it('skips backend call when no refresh token is stored', async () => {
    mockGetSecureItem.mockResolvedValueOnce(null);

    await authService.logout();

    expect(mockedApi.post).not.toHaveBeenCalled();
    expect(mockDeleteSecureItem).toHaveBeenCalledWith('accessToken');
  });
});

describe('authService.getProfile / sendVerificationEmail / getStoredTokens', () => {
  it('routes a client JWT to the client profile and maps it to CLIENT with no permissions', async () => {
    const payload = Buffer.from(JSON.stringify({ namespace: 'client' })).toString('base64url');
    mockGetSecureItem.mockResolvedValueOnce(`header.${payload}.signature`);
    mockedApi.get.mockResolvedValueOnce({
      data: { id: 'c1', name: 'Sara Al-Harbi', email: null, phone: '+966500000000', isActive: true },
    });

    const result = await authService.getProfile();

    expect(mockedApi.get).toHaveBeenCalledWith('/mobile/client/profile');
    expect(result.data).toEqual(expect.objectContaining({
      id: 'c1', role: 'CLIENT', firstName: 'Sara', lastName: 'Al-Harbi', permissions: [],
    }));
  });

  it('getProfile returns api envelope', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: { success: true, data: baseUser } });
    const r = await authService.getProfile();
    expect(r.success).toBe(true);
    expect(mockedApi.get).toHaveBeenCalledWith('/auth/me');
  });

  it('normalizes the bare staff /auth/me profile response', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: baseUser });
    const r = await authService.getProfile('staff');
    expect(r).toEqual({ success: true, data: baseUser });
  });

  it('getProfile rejects on 401', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('401'));
    await expect(authService.getProfile()).rejects.toThrow(/401/);
  });

  it('sendVerificationEmail posts to the correct endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { success: true } });
    await authService.sendVerificationEmail();
    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/auth/request-email-verification');
  });

  it('getStoredTokens reads both tokens from secure storage', async () => {
    mockGetSecureItem.mockResolvedValueOnce('a-tok');
    mockGetSecureItem.mockResolvedValueOnce('r-tok');
    const tokens = await authService.getStoredTokens();
    expect(tokens).toEqual({ accessToken: 'a-tok', refreshToken: 'r-tok' });
  });
});


describe('loginReviewAccount', () => {
  it('persists client tokens through the native session fence', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { sessionKind: 'client', tokens: { accessToken: 'review-access', refreshToken: 'review-refresh' } } });
    const result = await loginReviewAccount({ email: 'apple@review.sawaa.invalid', password: 'test-only-secret' });
    expect(mockedApi.post).toHaveBeenCalledWith('/mobile/auth/review-login', { email: 'apple@review.sawaa.invalid', password: 'test-only-secret' });
    expect(result.sessionKind).toBe('client');
    expect(nativeSessionState.isSessionCurrent(result.sessionEpoch)).toBe(true);
    expect(mockSetSecureItem).toHaveBeenCalledWith('accessToken', 'review-access');
    expect(mockSetSecureItem).toHaveBeenCalledWith('refreshToken', 'review-refresh');
    expect(mockSetSecureItem).not.toHaveBeenCalledWith('password', expect.anything());
  });
  it('rejects a staff response before storing credentials', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { sessionKind: 'staff', tokens: { accessToken: 'staff-access', refreshToken: 'staff-refresh' } } });
    await expect(loginReviewAccount({ email: 'apple@review.sawaa.invalid', password: 'test-only-secret' })).rejects.toThrow();
    expect(mockSetSecureItem).not.toHaveBeenCalled();
  });
  it('does not replace a newer login when a review response arrives late', async () => {
    let resolve!: (value: unknown) => void;
    mockedApi.post.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const pending = loginReviewAccount({ email: 'apple@review.sawaa.invalid', password: 'test-only-secret' });
    nativeSessionState.beginSession();
    resolve({ data: { sessionKind: 'client', tokens: { accessToken: 'old', refreshToken: 'old' } } });
    await expect(pending).rejects.toBeInstanceOf(SessionSupersededError);
    expect(mockSetSecureItem).not.toHaveBeenCalled();
  });
});
