import { VerifyEmailEntryPhoneHandler } from './verify-email-entry-phone.handler';
describe('VerifyEmailEntryPhoneHandler', () => {
  function fixture(changed = false) {
    const flow = { id: 'f', state: 'PHONE_PENDING', mode: 'LINK_PHONE', email: 'p@example.test', phone: '+966512345678', phoneChallengeId: 'p', boundUserId: 'u', boundClientId: 'c', identitySnapshot: { version: 1 } };
    const clientUpdate = jest.fn().mockResolvedValue({ id: 'c', email: flow.email, tokenVersion: 1 });
    const userUpdate = jest.fn();
    const tx = { user: { update: userUpdate }, client: { update: clientUpdate } };
    const store = { transaction: async (cb: Function) => cb(tx), lockContinuation: async () => flow, checkCode: async () => true, consume: async () => true };
    const identity = { classify: async () => ({ kind: 'link', user: { id: 'u', phone: flow.phone }, client: { id: 'c' } }), snapshot: () => ({ version: changed ? 2 : 1 }) };
    const tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'a', rawRefresh: 'r' }) };
    return { clientUpdate, userUpdate, tokens, handler: new VerifyEmailEntryPhoneHandler(store as never, identity as never, tokens as never) };
  }
  it('rejects changed identity before any contact write or refresh session', async () => {
    const f = fixture(true);
    await expect(f.handler.execute({ continuationToken: 't', phoneChallengeId: 'p', code: '123456' })).rejects.toMatchObject({ status: 409 });
    expect(f.tokens.issueTokenPair).not.toHaveBeenCalled();
    expect(f.clientUpdate).not.toHaveBeenCalled();
  });
  it('synchronizes both email verification anchors and issues a client session atomically', async () => {
    const f = fixture();
    expect(await f.handler.execute({ continuationToken: 't', phoneChallengeId: 'p', code: '123456' })).toMatchObject({ next: 'authenticated', sessionKind: 'client', tokens: { refreshToken: 'r' } });
    expect(f.clientUpdate.mock.calls[0][0].data).toMatchObject({ email: 'p@example.test', emailVerified: expect.any(Date) });
    expect(f.userUpdate.mock.calls[0][0].data).toMatchObject({ emailVerifiedAt: expect.any(Date) });
  });
});
