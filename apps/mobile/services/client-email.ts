import api from './api';

export type ClientEmailStatusValue = 'none' | 'unverified' | 'pending' | 'verified';

export type ClientEmailStatus = {
  status: ClientEmailStatusValue;
  /** Only ever returned for a verified address; never a legacy unverified one. */
  email: string | null;
  pendingEmail: string | null;
  prompt: boolean;
};

export type ClientEmailChallenge = {
  challengeId: string;
  maskedEmail: string;
  expiresIn: 300;
  retryAfterSeconds: 60;
};

const base = '/mobile/client/profile/email';

// The challenge id and code live in screen memory only; they are never put in
// route params, storage or logs, and the mutations never cache responses.
export const clientEmailService = {
  getStatus: () => api.get<ClientEmailStatus>(base).then(r => r.data),
  request: (body: { email: string }) => api.post<ClientEmailChallenge>(`${base}/request`, body).then(r => r.data),
  verify: (body: { challengeId: string; code: string }) => api.post<ClientEmailStatus>(`${base}/verify`, body).then(r => r.data),
  decline: () => api.post<ClientEmailStatus>(`${base}/decline`, {}).then(r => r.data),
};

/** Translate only API-safe codes; never render provider or transport messages. */
export function clientEmailError(failure: unknown): { key: string; retryAfterSeconds?: number } {
  const response = (
    failure as { response?: { status?: number; data?: { code?: string; message?: unknown; retryAfterSeconds?: number } } } | null
  )?.response;
  const code = response?.data?.code;
  const keys: Record<string, string> = {
    invalid_email: 'invalidEmail',
    email_unchanged: 'unchangedEmail',
    send_limited: 'sendLimited',
    delivery_unavailable: 'deliveryUnavailable',
    invalid_or_expired_code: 'invalidCode',
    details_unavailable: 'detailsUnavailable',
    email_verified: 'verifiedEmail',
  };
  const key = keys[code ?? ''] ?? (response?.status === 429 ? 'sendLimited' : response?.status === 503 ? 'deliveryUnavailable' : 'networkError');
  if (response?.status === 429 || response?.status === 503 || code === 'send_limited' || code === 'delivery_unavailable') {
    const retry = response?.data?.retryAfterSeconds;
    return { key, retryAfterSeconds: typeof retry === 'number' && Number.isFinite(retry) ? Math.max(1, retry) : 60 };
  }
  return { key };
}
