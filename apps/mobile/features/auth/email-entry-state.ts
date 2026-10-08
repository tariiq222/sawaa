import type { EmailChallenge, EmailVerified, PhoneChallenge } from '@/services/email-entry';
export type EmailEntryStep = 'email' | 'email_code' | 'register' | 'verify_phone' | 'phone_code' | 'unavailable';
export type EmailEntryState = {
  step: EmailEntryStep; email: string; code: string; challengeId: string;
  continuationToken: string; phoneChallengeId: string; maskedRecipient: string;
  expiresAt: number; retryAt: number; flowExpiresAt: number;
};
export const initialEmailEntryState = (email = ''): EmailEntryState => ({
  step: 'email', email, code: '', challengeId: '', continuationToken: '',
  phoneChallengeId: '', maskedRecipient: '', expiresAt: 0, retryAt: 0, flowExpiresAt: 0,
});
export type EmailEntryAction =
  | { type: 'restart' }
  | { type: 'email' | 'code'; value: string }
  | { type: 'emailChallenge'; result: EmailChallenge; now: number }
  | { type: 'phoneChallenge'; result: PhoneChallenge; now: number }
  | { type: 'verified'; result: EmailVerified; now: number }
  | { type: 'retry'; retryAt: number };
export function emailEntryReducer(state: EmailEntryState, action: EmailEntryAction): EmailEntryState {
  switch (action.type) {
    case 'restart': return initialEmailEntryState();
    case 'email': return { ...state, email: action.value };
    case 'code': return { ...state, code: action.value.replace(/[^0-9]/g, '').slice(0, 6) };
    case 'retry': return { ...state, retryAt: action.retryAt };
    case 'emailChallenge': return {
      ...state, step: 'email_code', challengeId: action.result.challengeId, code: '',
      maskedRecipient: action.result.maskedEmail, expiresAt: action.now + action.result.expiresIn * 1000,
      retryAt: action.now + action.result.retryAfterSeconds * 1000,
    };
    case 'phoneChallenge': return {
      ...state, step: 'phone_code', phoneChallengeId: action.result.phoneChallengeId,
      continuationToken: action.result.continuationToken, code: '', maskedRecipient: action.result.maskedPhone,
      expiresAt: action.now + action.result.expiresIn * 1000, retryAt: action.now + action.result.retryAfterSeconds * 1000,
    };
    case 'verified': {
      const result = action.result;
      if (result.next === 'authenticated') return initialEmailEntryState();
      if (result.next === 'unavailable') return { ...initialEmailEntryState(), step: 'unavailable' };
      return { ...initialEmailEntryState(result.email), step: result.next,
        continuationToken: result.continuationToken, flowExpiresAt: action.now + result.expiresIn * 1000 };
    }
  }
}
