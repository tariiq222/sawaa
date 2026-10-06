import { RequestEmailEntryPhoneHandler } from './request-email-entry-phone.handler';
describe('RequestEmailEntryPhoneHandler', () => {
  function fixture(mode = 'LINK_PHONE') {
    const flow = { id: 'f', state: 'DETAILS_PENDING', mode, email: 'p@example.test', boundUserId: 'u', boundClientId: 'c', identitySnapshot: {}, phoneMatchAttempts: 0, continuationExpiresAt: new Date(Date.now() + 600000) };
    const update = jest.fn(async ({ data }) => { if (data.phoneMatchAttempts) flow.phoneMatchAttempts++; });
    const tx = { mobileEmailFlow: { update } };
    const store = { transaction: async (cb: Function) => cb(tx), lockContinuation: async () => flow };
    const identity = { classify: async () => ({ kind: 'link', user: { id: 'u', phone: '+966512345678' }, client: { id: 'c' } }), snapshot: () => ({}), contactsFree: async () => true };
    const dispatch = { send: jest.fn().mockResolvedValue({ phoneChallengeId: 'p' }) };
    return { flow, update, dispatch, handler: new RequestEmailEntryPhoneHandler(store as never, identity as never, dispatch as never) };
  }
  it('commits five wrong-phone guesses and refuses subsequent guesses', async () => {
    const f = fixture();
    for (let i = 0; i < 5; i++) await expect(f.handler.execute({ continuationToken: 't', phone: '+966512345679' })).rejects.toMatchObject({ status: 409 });
    expect(f.flow.phoneMatchAttempts).toBe(5);
    await expect(f.handler.execute({ continuationToken: 't', phone: '+966512345678' })).rejects.toMatchObject({ response: { code: 'invalid_or_expired_flow' } });
    expect(f.dispatch.send).not.toHaveBeenCalled();
  });
  it('rejects registration-only fields in a linking flow', async () => {
    const f = fixture();
    await expect(f.handler.execute({ continuationToken: 't', phone: '+966512345678', firstName: 'Ali' })).rejects.toMatchObject({ status: 400 });
    expect(f.dispatch.send).not.toHaveBeenCalled();
  });
  it('requires explicit registration consent and names', async () => {
    const f = fixture('REGISTER');
    await expect(f.handler.execute({ continuationToken: 't', phone: '+966512345678' })).rejects.toMatchObject({ status: 400 });
    expect(f.dispatch.send).not.toHaveBeenCalled();
  });
});
