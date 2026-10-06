import { emailEntryReducer, initialEmailEntryState } from './email-entry-state';

describe('email entry state', () => {
  it.each(['register', 'verify_phone'] as const)('keeps %s proof only in local state and resets all secrets', next => {
    const verified = emailEntryReducer(initialEmailEntryState(), { type: 'verified', result: { next, email: 'a@example.test', continuationToken: 'secret', expiresIn: 600 }, now: 1000 });
    expect(verified.step).toBe(next);
    expect(verified.continuationToken).toBe('secret');
    expect(verified.flowExpiresAt).toBe(601000);
    expect(emailEntryReducer(verified, { type: 'restart' })).toEqual(initialEmailEntryState());
  });
  it('replaces rotated phone proof and uses server expiry', () => {
    const proven = emailEntryReducer(initialEmailEntryState(), { type: 'verified', result: { next: 'verify_phone', email: 'a@example.test', continuationToken: 'secret', expiresIn: 600 }, now: 0 });
    const state = emailEntryReducer(proven, { type: 'phoneChallenge', result: { phoneChallengeId: 'p2', continuationToken: 'rotated', maskedPhone: '***12', expiresIn: 120, retryAfterSeconds: 60 }, now: 2000 });
    expect(state).toMatchObject({ step: 'phone_code', phoneChallengeId: 'p2', continuationToken: 'rotated', expiresAt: 122000, retryAt: 62000, flowExpiresAt: 600000, code: '' });
  });
  it('does not retain secrets for unavailable identities', () => {
    expect(emailEntryReducer(initialEmailEntryState(), { type: 'verified', result: { next: 'unavailable' }, now: 0 })).toMatchObject({ step: 'unavailable', continuationToken: '' });
  });
});
