import type {
  ClientLoginPayload,
  ClientRegisterPayload,
  ClientAuthResponse,
} from '@deqah/shared';

let clientBaseUrl = '';
let getRefreshToken: (() => string | null) | null = null;

export function setClientBaseUrl(url: string): void {
  clientBaseUrl = url;
}

export function initClientAuth(cfg: {
  getRefreshToken: () => string | null;
}): void {
  getRefreshToken = cfg.getRefreshToken;
}

async function clientFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${clientBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { message?: string }).message ?? res.statusText,
    );
  }

  if (res.status === 204) return undefined as T;
  const json = (await res.json()) as unknown;
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in json
  ) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function clientLogin(
  payload: ClientLoginPayload,
): Promise<ClientAuthResponse> {
  return clientFetch<ClientAuthResponse>('/public/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function clientRegister(
  payload: ClientRegisterPayload,
): Promise<ClientAuthResponse> {
  return clientFetch<ClientAuthResponse>('/public/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.otpSessionToken}`,
    },
    body: JSON.stringify({ password: payload.password, name: payload.name, hCaptchaToken: payload.hCaptchaToken }),
  });
}

export async function clientRefresh(): Promise<{ accessToken: string; refreshToken: string }> {
  const rawToken = getRefreshToken?.();
  return clientFetch<{ accessToken: string; refreshToken: string }>(
    '/public/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ refreshToken: rawToken }),
    },
  );
}

export async function clientLogout(): Promise<void> {
  const rawToken = getRefreshToken?.();
  return clientFetch<void>('/public/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: rawToken }),
  });
}

export async function clientResetPassword(payload: {
  sessionToken: string;
  newPassword: string;
  hCaptchaToken: string;
}): Promise<void> {
  return clientFetch<void>('/public/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
