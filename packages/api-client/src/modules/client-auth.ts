import type {
  ClientLoginPayload,
  ClientRegisterPayload,
  ClientAuthResponse,
} from '@sawaa/shared';
import { apiRequest, setApiRequestBaseUrl } from '../client';

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
  payload: ClientLoginPayload,
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
