import { ResendEmailEntryPhoneHandler } from './resend-email-entry-phone.handler';
it.each(['PHONE_SENDING', 'DETAILS_PENDING', 'CONSUMED'])('does not resend from %s', async state => {
  const store = { transaction: async (fn: Function) => fn({}), lockContinuation: async () => ({ state, phone: '+966512345678', phoneChallengeId: 'p' }) };
  const send = jest.fn();
  const handler = new ResendEmailEntryPhoneHandler(store as never, { send } as never);
  await expect(handler.execute({ continuationToken: 't', phoneChallengeId: 'p' })).rejects.toMatchObject({ response: { code: 'invalid_or_expired_flow' } });
  expect(send).not.toHaveBeenCalled();
});
it('rejects a replaced phone challenge even with the current continuation', async () => {
  const store = { transaction: async (fn: Function) => fn({}), lockContinuation: async () => ({ state: 'PHONE_PENDING', phone: '+966512345678', phoneChallengeId: 'new' }) };
  const handler = new ResendEmailEntryPhoneHandler(store as never, {} as never);
  await expect(handler.execute({ continuationToken: 't', phoneChallengeId: 'old' })).rejects.toMatchObject({ status: 400 });
});
