import api from './api';
import { unregisterPushAsync } from './push';
import {
  getSecureItem,
} from '@/stores/secure-storage';
import {
  beginSession,
  clearSessionAtEpoch,
  fenceSession,
  getSessionEpoch,
  isSessionCurrent,
  persistSessionTokensAtEpoch,
} from './native-session-state';
import type { User } from '@/types/auth';
import { splitName } from '@/types/auth';
import type { ApiResponse } from '@/types/api';

export class SessionSupersededError extends Error {
  constructor() {
    super('Authentication completion was superseded by a newer session');
    this.name = 'SessionSupersededError';
  }
}

let accountClosureRequest: { epoch: number; promise: Promise<void> } | null = null;

export type VerifyOtpResponse = {
  tokens: { accessToken: string; refreshToken: string };
  sessionKind?: 'client' | 'staff';
};
export type VerifiedMobileOtpResponse = VerifyOtpResponse & { sessionEpoch: number; sessionKind?: 'client' | 'staff' };

export const loginReviewAccount = async (body: { email: string; password: string }): Promise<VerifiedMobileOtpResponse> => {
  const epoch = beginSession();
  const { data } = await api.post<VerifyOtpResponse>('/mobile/auth/review-login', body);
  if (!isSessionCurrent(epoch)) throw new SessionSupersededError();
  if (data.sessionKind !== 'client' || !data.tokens?.accessToken || !data.tokens?.refreshToken) {
    throw new Error('Invalid review account response');
  }
  const persisted = await persistSessionTokensAtEpoch(data.tokens, epoch);
  if (!persisted || !isSessionCurrent(epoch)) throw new SessionSupersededError();
  return { ...data, sessionEpoch: epoch };
};

export const requestEmailVerification = async () => {
  await assertStaffSession('request email verification');
  return api.post<{ success: true }>('/mobile/auth/request-email-verification').then(r => r.data);
};

export const authService = {
  requestAccountDeletion(): Promise<void> {
    const sessionEpoch = getSessionEpoch();
    if (accountClosureRequest?.epoch === sessionEpoch) return accountClosureRequest.promise;
    const pending = (async () => {
      const response = await api.delete<{ status: string }>('/mobile/client/profile');
      if (response.data?.status !== 'closed') {
        throw new Error('Account closure was not confirmed');
      }
      // A login that began while the request was pending owns a newer epoch.
      // Clear only the session whose account was closed.
      if (isSessionCurrent(sessionEpoch)) {
        await clearSessionAtEpoch(fenceSession());
      }
    })();
    accountClosureRequest = { epoch: sessionEpoch, promise: pending };
    void pending.finally(() => {
      if (accountClosureRequest?.promise === pending) accountClosureRequest = null;
    }).catch(() => undefined);
    return pending;
  },

  /** Logout: call backend + clear storage + clear Redux */
  async logout(): Promise<void> {
    const epoch = fenceSession();
    if (getSessionEpoch() === epoch) {
      try { await unregisterPushAsync(); } catch { /* best effort before clearing credentials */ }
    }
    try {
      const refreshToken = await getSecureItem('refreshToken');
      // A newer login may have replaced the token while SecureStore was
      // awaiting I/O. Never revoke that newer session from this logout.
      if (refreshToken && getSessionEpoch() === epoch) {
        await api.post('/mobile/auth/logout', { refreshToken });
      }
    } catch {
      // Backend call may fail — still clear local state
    }
    await clearSessionAtEpoch(epoch);
  },

  /** GET /auth/me */
  async getProfile(kind?: 'client' | 'staff'): Promise<ApiResponse<User>> {
    const sessionKind = kind ?? await getSessionKindFromAccessToken();
    if (sessionKind === 'client') {
      const response = await api.get<unknown>('/mobile/client/profile');
      return { success: true, data: mapClientProfile(response.data) };
    }
    const response = await api.get<ApiResponse<User>>('/auth/me');
    const raw = response.data as unknown as ApiResponse<User> | User;
    if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
      return raw as ApiResponse<User>;
    }
    return { success: true, data: raw as User };
  },

  /** POST /mobile/auth/request-email-verification — sends a verification link to the authenticated user's email. */
  async sendVerificationEmail(): Promise<ApiResponse> {
    await assertStaffSession('send email verification');
    const response = await api.post<ApiResponse>('/mobile/auth/request-email-verification');
    return response.data;
  },

  /** Hydrate: read tokens from storage for app restart */
  async getStoredTokens() {
    const accessToken = await getSecureItem('accessToken');
    const refreshToken = await getSecureItem('refreshToken');
    return { accessToken, refreshToken };
  },

  /**
   * POST /public/otp/request — send OTP for password reset.
   * Uses purpose CLIENT_PASSWORD_RESET so it cannot be confused with login OTPs.
   */
  async requestPasswordResetOtp(identifier: string): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/public/otp/request', {
      channel: identifier.includes('@') ? 'EMAIL' : 'SMS',
      identifier: identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.trim(),
      purpose: 'CLIENT_PASSWORD_RESET',
      
    });
    return response.data;
  },

  /**
   * POST /public/otp/verify — verify the reset OTP, returns a short-lived sessionToken.
   */
  async verifyPasswordResetOtp(
    identifier: string,
    code: string,
  ): Promise<{ sessionToken: string }> {
    const response = await api.post<{ sessionToken: string }>(
      '/public/otp/verify',
      {
        channel: identifier.includes('@') ? 'EMAIL' : 'SMS',
        identifier: identifier.includes('@') ? identifier.trim().toLowerCase() : identifier.trim(),
        code,
        purpose: 'CLIENT_PASSWORD_RESET',
      
      },
    );
    return response.data;
  },

  /**
   * POST /public/auth/reset-password — set the new password using the verified sessionToken.
   */
  async resetClientPassword(
    sessionToken: string,
    newPassword: string,
  ): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(
      '/public/auth/reset-password',
      {
        sessionToken,
        newPassword,
      
      },
    );
    return response.data;
  },
};

async function getSessionKindFromAccessToken(): Promise<'client' | 'staff'> {
  const token = await getSecureItem('accessToken');
  if (!token) return 'staff';
  try {
    const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as { namespace?: string };
    return payload.namespace === 'client' ? 'client' : 'staff';
  } catch {
    return 'staff';
  }
}

async function assertStaffSession(action: string): Promise<void> {
  if ((await getSessionKindFromAccessToken()) === 'client') {
    throw new Error(`Client sessions cannot ${action}`);
  }
}

function decodeBase64Url(value: string): string {
  if (!value) return '';
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    try {
      return decodeURIComponent(Array.from(binary, (char) => `%${(char.codePointAt(0) ?? 0).toString(16).padStart(2, '0')}`).join(''));
    } catch {
      return binary;
    }
  }
  return '';
}

function mapClientProfile(raw: unknown): User {
  const profile = raw as Record<string, unknown>;
  const name = typeof profile.name === 'string' ? profile.name : '';
  const names = splitName(name);
  return {
    id: String(profile.id ?? ''),
    email: typeof profile.email === 'string' ? profile.email : '',
    name,
    firstName: names.firstName,
    lastName: names.lastName,
    phone: typeof profile.phone === 'string' ? profile.phone : null,
    gender: typeof profile.gender === 'string' ? profile.gender : null,
    avatarUrl: typeof profile.avatarUrl === 'string' ? profile.avatarUrl : null,
    isActive: profile.isActive !== false,
    role: 'CLIENT',
    isSuperAdmin: false,
    permissions: [],
  };
}
