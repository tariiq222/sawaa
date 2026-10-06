import { MobileEmailSendLimiter } from './mobile-email-send-limiter';

describe('MobileEmailSendLimiter', () => {
  it('fails closed when Redis is unavailable', async () => {
    const limiter = new MobileEmailSendLimiter({ getClient: () => ({ eval: async () => { throw Error('offline'); } }) } as never);
    await expect(limiter.reserve('EMAIL', 'person@example.test')).rejects.toMatchObject({ status: 503, response: { code: 'delivery_unavailable' } });
  });
  it('uses an identifier-scoped atomic reservation and returns retry metadata', async () => {
    const evalFn = jest.fn().mockResolvedValueOnce([1, 0]).mockResolvedValueOnce([0, 60]);
    const limiter = new MobileEmailSendLimiter({ getClient: () => ({ eval: evalFn }) } as never);
    await limiter.reserve('EMAIL', 'person@example.test');
    await expect(limiter.reserve('EMAIL', 'person@example.test')).rejects.toMatchObject({ status: 429, response: { retryAfterSeconds: 60 } });
    expect(evalFn.mock.calls[0][2]).toBe(evalFn.mock.calls[1][2]);
    expect(evalFn.mock.calls[0][2]).not.toContain('person');
  });
});
