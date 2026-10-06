import api from './api';

export type NativeSession = {
  tokens: { accessToken: string; refreshToken: string };
  sessionKind: 'client' | 'staff';
};
export type EmailChallenge = { challengeId: string; maskedEmail: string; expiresIn: 300; retryAfterSeconds: 60 };
export type EmailVerified =
  | ({ next: 'authenticated' } & NativeSession)
  | { next: 'register' | 'verify_phone'; continuationToken: string; email: string; expiresIn: 600 }
  | { next: 'unavailable' };
export type PhoneChallenge = {
  phoneChallengeId: string; continuationToken: string; maskedPhone: string;
  expiresIn: number; retryAfterSeconds: 60;
};
export type PhoneDetails = { phone: string; firstName?: string; lastName?: string; privacyAccepted?: true };
type PhoneProof = { phoneChallengeId: string; continuationToken: string };
const post = <T>(path: string, body: unknown) => api.post<T>(`/mobile/auth/email-entry/${path}`, body).then(r => r.data);
// These requests never persist authentication: only a fenced authenticated
// response may be promoted by the screen's session completion helper.
export const emailEntryService = {
  request: (body: { email: string }) => post<EmailChallenge>('request', body),
  verify: (body: { challengeId: string; code: string }) => post<EmailVerified>('verify', body),
  requestPhone: (body: PhoneDetails & { continuationToken: string }) => post<PhoneChallenge>('request-phone', body),
  resendPhone: (body: PhoneProof) => post<PhoneChallenge>('resend-phone', body),
  verifyPhone: (body: PhoneProof & { code: string }) => post<NativeSession & { next: 'authenticated' }>('verify-phone', body),
};

/** Translate only API-safe codes; never render provider or transport messages. */
export function emailEntryError(failure: unknown): { key: string; retryAfterSeconds?: number } {
  const response = (failure as { response?: { status?: number; data?: { code?: string; message?: unknown; retryAfterSeconds?: number } } } | null)?.response;
  // normalizePhone throws this exact safe machine message before DTO validation.
  // Never render or broadly interpret arbitrary server-provided message text.
  const code = response?.data?.code ?? (response?.status === 400 && response.data?.message === 'invalid_phone' ? 'invalid_phone' : undefined);
  const keys: Record<string, string> = {
    invalid_phone: 'invalidPhone', invalid_or_expired_code: 'invalidCode', invalid_or_expired_flow: 'expiredFlow',
    details_unavailable: 'detailsUnavailable', delivery_unavailable: 'deliveryUnavailable',
  };
  const key = keys[code ?? ''] ?? (response?.status === 429 ? 'rateLimited' : response?.status === 503 ? 'deliveryUnavailable' : response?.status === 400 ? 'invalidDetails' : 'networkError');
  if (response?.status === 429 || response?.status === 503 || code === 'delivery_unavailable') {
    const retry = response?.data?.retryAfterSeconds;
    return { key, retryAfterSeconds: typeof retry === 'number' && Number.isFinite(retry) ? Math.max(1, retry) : 60 };
  }
  return { key };
}
