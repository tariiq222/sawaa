import api from './api';
import type { NativeSession } from './email-entry';

export type PhoneChallenge = {
  challengeId: string;
  maskedPhone: string;
  expiresIn: number;
  retryAfterSeconds: number;
};

export type PhoneVerified =
  | ({ next: 'authenticated'; emailPrompt: boolean } & NativeSession)
  | { next: 'register'; continuationToken: string; expiresIn: 600 }
  | { next: 'unavailable' };

export type PhoneCompletion = { next: 'authenticated'; emailPrompt: false } & NativeSession;

export type PhoneRegistrationDetails = {
  continuationToken: string;
  firstName: string;
  lastName: string;
  email?: string;
  privacyAccepted: true;
};

const post = <T>(path: string, body: unknown) =>
  api.post<T>(`/mobile/auth/phone-entry/${path}`, body).then(r => r.data);

// These requests never persist authentication: only a fenced authenticated
// response may be promoted by the screen's session completion helper.
export const phoneEntryService = {
  request: (body: { phone: string }) => post<PhoneChallenge>('request', body),
  resend: (body: { challengeId: string }) => post<PhoneChallenge>('resend', body),
  verify: (body: { challengeId: string; code: string }) => post<PhoneVerified>('verify', body),
  complete: (body: PhoneRegistrationDetails) => post<PhoneCompletion>('complete', body),
};

/** Translate only API-safe codes; never render provider or transport messages. */
export function phoneEntryError(failure: unknown): { key: string; retryAfterSeconds?: number } {
  const response = (
    failure as { response?: { status?: number; data?: { code?: string; message?: unknown; retryAfterSeconds?: number } } } | null
  )?.response;
  const code = response?.data?.code;
  const keys: Record<string, string> = {
    invalid_phone: 'invalidPhone',
    send_limited: 'rateLimited',
    delivery_unavailable: 'deliveryUnavailable',
    invalid_or_expired_code: 'invalidCode',
    invalid_or_expired_flow: 'expiredFlow',
    invalid_details: 'invalidDetails',
    details_unavailable: 'detailsUnavailable',
  };
  const key = keys[code ?? ''] ?? (response?.status === 429 ? 'rateLimited' : response?.status === 503 ? 'deliveryUnavailable' : 'networkError');
  if (response?.status === 429 || response?.status === 503 || code === 'send_limited' || code === 'delivery_unavailable') {
    const retry = response?.data?.retryAfterSeconds;
    return { key, retryAfterSeconds: typeof retry === 'number' && Number.isFinite(retry) ? Math.max(1, retry) : 60 };
  }
  return { key };
}
