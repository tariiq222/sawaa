import type {
  ClientRegisterPayload,
  ClientAuthResponse,
} from '@sawaa/shared';
import { apiRequest, setApiRequestBaseUrl } from '../client';

/**
 * POST /public/auth/login body — exactly one of `email` or `phone` must be
 * provided. `phone` must be E.164 Saudi format (`+9665XXXXXXXX`).
 */
export type ClientLoginRequest =
  | { email: string; phone?: never; password: string }
  | { phone: string; email?: never; password: string };

export function setClientBaseUrl(url: string): void {
  setApiRequestBaseUrl(url);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function initClientAuth(_cfg: {
  getRefreshToken: () => string | null;
}): void {
  // Refresh token is now handled via httpOnly cookie — no localStorage needed.
}

export async function clientLogin(
  payload: ClientLoginRequest,
): Promise<ClientAuthResponse> {
  return apiRequest<ClientAuthResponse>('/public/auth/login', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(payload),
  });
}

export async function clientRegister(
  payload: ClientRegisterPayload,
): Promise<ClientAuthResponse> {
  return apiRequest<ClientAuthResponse>('/public/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.otpSessionToken}`,
    },
    body: JSON.stringify({ password: payload.password, name: payload.name }),
  });
}

export async function clientLogout(): Promise<void> {
  return apiRequest<void>('/public/auth/logout', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({}),
  });
}

export async function clientResetPassword(payload: {
  sessionToken: string;
  newPassword: string;
}): Promise<void> {
  return apiRequest<void>('/public/auth/reset-password', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify(payload),
  });
}
