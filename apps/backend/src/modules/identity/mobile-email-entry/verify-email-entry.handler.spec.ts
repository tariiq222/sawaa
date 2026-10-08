import { VerifyEmailEntryHandler } from './verify-email-entry.handler';
describe('VerifyEmailEntryHandler', () => {
  function fixture(kind: string) {
    const update = jest.fn();
    const tx = { mobileEmailFlow: { update } };
    const store = { transaction: async (cb: Function) => cb(tx), lock: async () => ({ id: 'f', state: 'EMAIL_PENDING', email: 'p@example.test', createdAt: new Date() }), checkCode: async () => true, consume: jest.fn().mockResolvedValue(true) };
    const clientTokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'a', rawRefresh: 'r' }) };
    const identity = { classify: async () => ({ kind, user: { id: 'u' }, client: { id: 'c' } }), snapshot: () => ({ user: 'u', client: 'c' }) };
    return { handler: new VerifyEmailEntryHandler(store as never, identity as never, clientTokens as never, {} as never), store, update, clientTokens };
  }
  it('consumes a disabled account proof without activating or issuing a session', async () => {
    const f = fixture('unavailable');
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toEqual({ next: 'unavailable' });
    expect(f.store.consume).toHaveBeenCalled();
    expect(f.clientTokens.issueTokenPair).not.toHaveBeenCalled();
  });
  it('returns native client tokens only after consumption', async () => {
    const f = fixture('client');
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toEqual({ next: 'authenticated', sessionKind: 'client', tokens: { accessToken: 'a', refreshToken: 'r' } });
    expect(f.store.consume.mock.invocationCallOrder[0]).toBeLessThan(f.clientTokens.issueTokenPair.mock.invocationCallOrder[0]);
  });
  it('unknown identity only binds registration proof and clears email code', async () => {
    const f = fixture('register');
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toMatchObject({ next: 'register', expiresIn: 600, continuationToken: expect.any(String) });
    expect(f.update.mock.calls[0][0].data).toMatchObject({ state: 'DETAILS_PENDING', emailCodeHash: null, mode: 'REGISTER' });
    expect(f.clientTokens.issueTokenPair).not.toHaveBeenCalled();
  });
});
