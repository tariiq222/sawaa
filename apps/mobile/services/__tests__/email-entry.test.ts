import api from '../api';
import { emailEntryService, emailEntryError } from '../email-entry';
jest.mock('../api', () => ({ __esModule: true, default: { post: jest.fn() } }));
const post = jest.mocked(api.post);
const session = { next: 'authenticated', tokens: { accessToken: 'access', refreshToken: 'refresh' }, sessionKind: 'client' };
it('uses the isolated email-entry endpoint and preserves the next result without persisting it', async () => {
  post.mockResolvedValueOnce({ data: session });
  expect(await emailEntryService.verify({ challengeId: 'challenge', code: '123456' })).toEqual(session);
  expect(post).toHaveBeenCalledWith('/mobile/auth/email-entry/verify', { challengeId: 'challenge', code: '123456' });
});
it('sends phone continuation in the body and accepts rotation', async () => {
  post.mockResolvedValueOnce({ data: { phoneChallengeId: 'new', continuationToken: 'rotated' } });
  expect(await emailEntryService.resendPhone({ phoneChallengeId: 'old', continuationToken: 'secret' })).toEqual({ phoneChallengeId: 'new', continuationToken: 'rotated' });
  expect(post).toHaveBeenLastCalledWith('/mobile/auth/email-entry/resend-phone', { phoneChallengeId: 'old', continuationToken: 'secret' });
});

describe('safe error decoding', () => {
  it.each([
    [503, { error: 'SERVICE_UNAVAILABLE', message: 'An unexpected error occurred' }, { key: 'deliveryUnavailable', retryAfterSeconds: 60 }],
    [429, { code: 'send_limited', retryAfterSeconds: 90 }, { key: 'rateLimited', retryAfterSeconds: 90 }],
    [400, { statusCode: 400, error: 'BAD_REQUEST', message: 'invalid_phone' }, { key: 'invalidPhone' }],
    [400, { statusCode: 400, error: 'BAD_REQUEST', message: ['firstName must be shorter than or equal to 100 characters'] }, { key: 'invalidDetails' }],
    [400, { code: 'invalid_or_expired_code' }, { key: 'invalidCode' }],
    [400, { code: 'invalid_or_expired_flow' }, { key: 'expiredFlow' }],
    [409, { code: 'details_unavailable' }, { key: 'detailsUnavailable' }],
  ])('maps HTTP %s to recovery without exposing server messages', (status, data, expected) => {
    expect(emailEntryError({ response: { status, data } })).toEqual(expected);
  });
  it('distinguishes connection failure from delivery rejection', () => {
    expect(emailEntryError(new Error('connection lost'))).toEqual({ key: 'networkError' });
  });
});
