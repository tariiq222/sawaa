import { initialPhoneEntryState, phoneEntryReducer } from './phone-entry-state';

describe('phone entry state', () => {
  it('keeps the register proof only in local state and resets all secrets on restart', () => {
    const verified = phoneEntryReducer(initialPhoneEntryState(), {
      type: 'verified',
      result: { next: 'register', continuationToken: 'secret', expiresIn: 600 },
      now: 1000,
    });
    expect(verified).toMatchObject({ step: 'details', continuationToken: 'secret', flowExpiresAt: 601000 });
    expect(phoneEntryReducer(verified, { type: 'restart' })).toEqual(initialPhoneEntryState());
  });
  it('stores the challenge with server expiry and resend cooldown and clears the typed code', () => {
    const challenged = phoneEntryReducer(
      { ...initialPhoneEntryState('0501234567'), code: '12' },
      { type: 'challenge', result: { challengeId: 'c1', maskedPhone: '•••12', expiresIn: 300, retryAfterSeconds: 60 }, now: 2000 },
    );
    expect(challenged).toMatchObject({
      step: 'code', challengeId: 'c1', maskedPhone: '•••12', code: '',
      expiresAt: 302000, retryAt: 62000,
    });
    const rotated = phoneEntryReducer(challenged, {
      type: 'challenge', result: { challengeId: 'c2', maskedPhone: '•••12', expiresIn: 120, retryAfterSeconds: 60 }, now: 4000,
    });
    expect(rotated).toMatchObject({ challengeId: 'c2', expiresAt: 124000, retryAt: 64000 });
  });
  it('clears every secret once verification authenticates', () => {
    const challenged = phoneEntryReducer(initialPhoneEntryState(), {
      type: 'challenge', result: { challengeId: 'c', maskedPhone: '•••12', expiresIn: 300, retryAfterSeconds: 60 }, now: 0,
    });
    expect(phoneEntryReducer(challenged, {
      type: 'verified',
      result: { next: 'authenticated', emailPrompt: false, sessionKind: 'client', tokens: { accessToken: 'a', refreshToken: 'r' } },
      now: 1,
    })).toEqual(initialPhoneEntryState());
  });
  it('does not retain any proof for unavailable identities', () => {
    expect(phoneEntryReducer(initialPhoneEntryState(), { type: 'verified', result: { next: 'unavailable' }, now: 0 }))
      .toMatchObject({ step: 'unavailable', continuationToken: '', challengeId: '' });
  });
  it('returns to the phone step keeping only the typed number', () => {
    const challenged = phoneEntryReducer(initialPhoneEntryState('0501234567'), {
      type: 'challenge', result: { challengeId: 'c', maskedPhone: '•••67', expiresIn: 300, retryAfterSeconds: 60 }, now: 0,
    });
    expect(phoneEntryReducer(challenged, { type: 'editPhone' })).toEqual(initialPhoneEntryState('0501234567'));
    const unavailable = phoneEntryReducer(challenged, { type: 'verified', result: { next: 'unavailable' }, now: 1 });
    expect(phoneEntryReducer(unavailable, { type: 'editPhone' })).toEqual(initialPhoneEntryState('0501234567'));
  });
  it('bounds the code field to six digits and applies resend retry timestamps', () => {
    const base = { ...initialPhoneEntryState(), expiresAt: Infinity };
    expect(phoneEntryReducer(base, { type: 'code', value: '12a4567' })).toMatchObject({ code: '124567' });
    expect(phoneEntryReducer(base, { type: 'retry', retryAt: 61000 })).toMatchObject({ retryAt: 61000 });
  });
});
