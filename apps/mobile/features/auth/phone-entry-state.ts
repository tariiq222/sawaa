import type { PhoneChallenge, PhoneVerified } from '@/services/phone-entry';

export type PhoneEntryStep = 'phone' | 'code' | 'details' | 'unavailable';

export type PhoneEntryState = {
  step: PhoneEntryStep;
  phone: string;
  code: string;
  challengeId: string;
  maskedPhone: string;
  continuationToken: string;
  expiresAt: number;
  retryAt: number;
  flowExpiresAt: number;
};

export const initialPhoneEntryState = (phone = ''): PhoneEntryState => ({
  step: 'phone', phone, code: '', challengeId: '', maskedPhone: '',
  continuationToken: '', expiresAt: 0, retryAt: 0, flowExpiresAt: 0,
});

export type PhoneEntryAction =
  | { type: 'restart' }
  | { type: 'editPhone' }
  | { type: 'phone' | 'code'; value: string }
  | { type: 'challenge'; result: PhoneChallenge; now: number }
  | { type: 'verified'; result: PhoneVerified; now: number }
  | { type: 'retry'; retryAt: number };

export function phoneEntryReducer(state: PhoneEntryState, action: PhoneEntryAction): PhoneEntryState {
  switch (action.type) {
    case 'restart': return initialPhoneEntryState();
    // Back to the phone step with the typed number kept; every secret is dropped.
    case 'editPhone': return initialPhoneEntryState(state.phone);
    case 'phone': return { ...state, phone: action.value };
    case 'code': return { ...state, code: action.value.replace(/[^0-9]/g, '').slice(0, 6) };
    case 'retry': return { ...state, retryAt: action.retryAt };
    case 'challenge': return {
      ...state, step: 'code', challengeId: action.result.challengeId, code: '',
      maskedPhone: action.result.maskedPhone,
      expiresAt: action.now + action.result.expiresIn * 1000,
      retryAt: action.now + action.result.retryAfterSeconds * 1000,
    };
    case 'verified': {
      const result = action.result;
      if (result.next === 'authenticated') return initialPhoneEntryState();
      if (result.next === 'unavailable') return { ...initialPhoneEntryState(state.phone), step: 'unavailable' };
      return {
        ...initialPhoneEntryState(), step: 'details',
        continuationToken: result.continuationToken,
        flowExpiresAt: action.now + result.expiresIn * 1000,
      };
    }
  }
}
