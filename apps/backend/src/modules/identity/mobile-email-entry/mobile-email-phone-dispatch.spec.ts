import { MobileEmailPhoneDispatch } from './mobile-email-phone-dispatch';
import { MobileEmailFlowStore, hashContinuation } from './mobile-email-flow.store';
describe('MobileEmailPhoneDispatch', () => {
  function fixture(fail = false) {
    const flow = { id: 'f', state: 'DETAILS_PENDING', phone: '+966512345678', continuationExpiresAt: new Date(Date.now() + 90000), createdAt: new Date(), continuationHash: hashContinuation('original') };
    const update = jest.fn(async ({ data }) => { Object.assign(flow, data); });
    const tx = { mobileEmailFlow: { update } };
    const store = { transaction: async (cb: Function) => cb(tx), lockContinuation: async () => flow, settlePhone: jest.fn().mockResolvedValue(true) };
    const limiter = { reserve: async () => ({}), settle: jest.fn() };
    const delivery = { send: async () => { expect(flow.state).toBe('PHONE_SENDING'); if (fail) throw Error('timeout'); } };
    return { flow, store, update, subject: new MobileEmailPhoneDispatch(store as never, limiter as never, delivery as never) };
  }
  it('caps SMS expiry at email proof expiry and rotates the continuation after acceptance', async () => {
    const f = fixture();
    const result = await f.subject.send({ id: 'f', continuationToken: 'original', phone: f.flow.phone });
    expect(result.expiresIn).toBeLessThanOrEqual(90);
    expect(f.update.mock.calls[0][0].data.phoneExpiresAt).toEqual(f.flow.continuationExpiresAt);
    expect(f.store.settlePhone).toHaveBeenCalledWith('f', result.phoneChallengeId, true, hashContinuation(result.continuationToken));
    expect(result.continuationToken).not.toBe('original');
  });
  it('does not rotate the continuation on an ambiguous provider failure', async () => {
    const f = fixture(true);
    await expect(f.subject.send({ id: 'f', continuationToken: 'original', phone: f.flow.phone })).rejects.toMatchObject({ status: 503 });
    expect(f.store.settlePhone).toHaveBeenCalledWith('f', expect.any(String), false);
    expect(f.flow.continuationHash).toBe(hashContinuation('original'));
  });
});
