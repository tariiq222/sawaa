import api from './api';

export type ClientPhoneChallenge = {
  challengeId: string;
  maskedPhone: string;
  expiresIn: 300;
  retryAfterSeconds: 60;
};

export type ClientPhoneVerification = {
  phone: string;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
};

const base = '/mobile/client/profile/phone';

// The challenge id, code and the returned tokens live in screen memory only;
// they are never put in route params, storage or logs, and the mutations never
// cache responses. The tokens reach persistent storage exclusively through
// persistSessionTokensAtEpoch in native-session-state.
export const clientPhoneService = {
  request: (body: { phone: string }) => api.post<ClientPhoneChallenge>(`${base}/request`, body).then(r => r.data),
  verify: (body: { challengeId: string; code: string }) => api.post<ClientPhoneVerification>(`${base}/verify`, body).then(r => r.data),
};

/** Translate only API-safe codes; never render provider or transport messages. */
export function clientPhoneError(failure: unknown): { key: string; retryAfterSeconds?: number } {
  const response = (
    failure as { response?: { status?: number; data?: { code?: string; message?: unknown; retryAfterSeconds?: number } } } | null
  )?.response;
  const code = response?.data?.code;
  const keys: Record<string, string> = {
    invalid_phone: 'invalidPhone',
    phone_unchanged: 'unchangedPhone',
    send_limited: 'sendLimited',
    delivery_unavailable: 'deliveryUnavailable',
    invalid_or_expired_code: 'invalidCode',
    details_unavailable: 'detailsUnavailable',
  };
  const key = keys[code ?? ''] ?? (response?.status === 429 ? 'sendLimited' : response?.status === 503 ? 'deliveryUnavailable' : 'networkError');
  if (response?.status === 429 || response?.status === 503 || code === 'send_limited' || code === 'delivery_unavailable') {
    const retry = response?.data?.retryAfterSeconds;
    return { key, retryAfterSeconds: typeof retry === 'number' && Number.isFinite(retry) ? Math.max(1, retry) : 60 };
  }
  return { key };
}
