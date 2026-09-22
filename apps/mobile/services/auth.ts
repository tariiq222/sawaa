import api from './api';
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
import type {
  LoginRequest,
  LoginWithOtpRequest,
  VerifyOtpRequest,
  AuthResponse,
  User,
} from '@/types/auth';
import { splitName } from '@/types/auth';
import type { ApiResponse } from '@/types/api';

export class SessionSupersededError extends Error {
  constructor() {
    super('Authentication completion was superseded by a newer session');
    this.name = 'SessionSupersededError';
  }
}

export type RegisterPayload = { firstName: string; lastName: string; phone: string; email: string };
export type RegisterResponse = { userId: string; maskedPhone: string };

export type RequestLoginOtpPayload = { identifier: string };
export type RequestLoginOtpResponse = { maskedIdentifier: string };

export type VerifyOtpPayload = { identifier: string; code: string; purpose: 'register' | 'login' };
export type VerifyOtpResponse = {
  tokens: { accessToken: string; refreshToken: string };
  sessionKind?: 'client' | 'staff';
};
export type VerifiedMobileOtpResponse = VerifyOtpResponse & { sessionEpoch: number; sessionKind?: 'client' | 'staff' };

export const registerUser = (body: RegisterPayload) =>
  api.post<RegisterResponse>('/mobile/auth/register', body).then(r => r.data);

export const requestLoginOtp = (body: RequestLoginOtpPayload) =>
  api.post<RequestLoginOtpResponse>('/mobile/auth/request-login-otp', body).then(r => r.data);

export const verifyMobileOtp = async (body: VerifyOtpPayload): Promise<VerifiedMobileOtpResponse> => {
  const epoch = beginSession();
  const response = await api.post<VerifyOtpResponse>('/mobile/auth/verify-otp', body);
  const data = response.data;
  if (!isSessionCurrent(epoch)) {
    throw new SessionSupersededError();
  }
  const persisted = await persistSessionTokensAtEpoch(data.tokens, epoch);
  if (!persisted || !isSessionCurrent(epoch)) {
    throw new SessionSupersededError();
  }
  return { ...data, sessionEpoch: epoch };
};

export const requestEmailVerification = async () => {
  await assertStaffSession('request email verification');
  return api.post<{ success: true }>('/mobile/auth/request-email-verification').then(r => r.data);
};

interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

/**
 * Accept either the legacy `{ success, data }` envelope or the current
 * bare `{ accessToken, refreshToken, user, expiresIn? }` backend shape.
 * Callers can continue to read `response.success` / `response.data` uniformly.
 */
function normalizeAuthResponse(raw: unknown): AuthResponse {
  const r = raw as Partial<AuthResponse> & {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    user?: User;
  };
  if (r && typeof r === 'object' && 'success' in r && 'data' in r && r.data) {
    return r as AuthResponse;
  }
  if (r && r.accessToken && r.refreshToken && r.user) {
    return {
      success: true,
      data: {
        accessToken: r.accessToken,
        refreshToken: r.refreshToken,
        expiresIn: r.expiresIn ?? 900,
        user: r.user,
      },
    };
  }
  return { success: false, data: undefined as never };
}

export const authService = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const epoch = beginSession();
    const response = await api.post<unknown>('/auth/login', data);
    const normalized = normalizeAuthResponse(response.data);
    if (normalized.success && normalized.data) {
      await persistTokens(normalized.data, epoch);
    }
    return normalized;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const epoch = beginSession();
    const response = await api.post<unknown>('/auth/register', data);
    const normalized = normalizeAuthResponse(response.data);
    if (normalized.success && normalized.data) {
      await persistTokens(normalized.data, epoch);
    }
    return normalized;
  },

  /** POST /auth/login/otp/send */
  async sendOtp(data: LoginWithOtpRequest): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>(
      '/auth/login/otp/send',
      data,
    );
    return response.data;
  },

  /** POST /auth/login/otp/verify — field is "code" not "otp" */
  async verifyOtp(data: VerifyOtpRequest): Promise<AuthResponse> {
    const epoch = beginSession();
    const response = await api.post<unknown>(
      '/auth/login/otp/verify',
      data,
    );
    const normalized = normalizeAuthResponse(response.data);
    if (normalized.success && normalized.data) {
      await persistTokens(normalized.data, epoch);
    }
    return normalized;
  },

  /**
   * Close the signed-in client account, then clear this device.
   * The server keeps clinical and financial records and revokes every session.
   */
  async requestAccountDeletion(): Promise<void> {
    await api.delete('/mobile/client/profile');
    await this.logout();
  },

  /** Logout: call backend + clear storage + clear Redux */
  async logout(): Promise<void> {
    const epoch = fenceSession();
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
  async requestPasswordResetOtp(email: string): Promise<ApiResponse> {
    const response = await api.post<ApiResponse>('/public/otp/request', {
      channel: 'EMAIL',
      identifier: email,
      purpose: 'CLIENT_PASSWORD_RESET',
      
    });
    return response.data;
  },

  /**
   * POST /public/otp/verify — verify the reset OTP, returns a short-lived sessionToken.
   */
  async verifyPasswordResetOtp(
    email: string,
    code: string,
  ): Promise<{ sessionToken: string }> {
    const response = await api.post<{ sessionToken: string }>(
      '/public/otp/verify',
      {
        channel: 'EMAIL',
        identifier: email,
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

async function persistTokens(data: NonNullable<AuthResponse['data']>, epoch: number) {
  const persisted = await persistSessionTokensAtEpoch(
    { accessToken: data.accessToken, refreshToken: data.refreshToken ?? '' },
    epoch,
  );
  if (!persisted || !isSessionCurrent(epoch)) {
    throw new SessionSupersededError();
  }
}

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
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    try {
      return decodeURIComponent(Array.from(binary, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''));
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
