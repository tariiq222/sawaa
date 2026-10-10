import { CompletePhoneEntryHandler } from './complete-phone-entry.handler';

describe('CompletePhoneEntryHandler', () => {
  function fixture() {
    const tx = { user: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() }, client: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'c', email: null }) }, $queryRaw: jest.fn() };
    const store = { transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx), lockContinuation: jest.fn().mockResolvedValue({ id: 'f', phone: '+966512345678', state: 'DETAILS_PENDING' }), consume: jest.fn().mockResolvedValue(true) };
    const tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'a', rawRefresh: 'r' }) };
    return { handler: new CompletePhoneEntryHandler(store as never, tokens as never), tx, store, tokens };
  }
  const cmd = { continuationToken: 'proof', firstName: ' First ', lastName: ' Last ', email: ' Test@EXAMPLE.TEST ', privacyAccepted: true as const };
  it('creates only Client and pendingEmail, never email or User', async () => {
    const f = fixture();
    expect(await f.handler.execute(cmd)).toEqual({ next: 'authenticated', sessionKind: 'client', emailPrompt: false, tokens: { accessToken: 'a', refreshToken: 'r' } });
    expect(f.tx.client.create.mock.calls[0][0].data).toMatchObject({ firstName: 'First', lastName: 'Last', name: 'First Last', pendingEmail: 'test@example.test', accountType: 'FULL', source: 'ONLINE' });
    expect(f.tx.client.create.mock.calls[0][0].data).not.toHaveProperty('email');
    expect(f.tx.user.create).not.toHaveBeenCalled();
    expect(f.tokens.issueTokenPair.mock.calls[0][1]).toBe(f.tx);
  });
  it.each(['client', 'user'] as const)('rechecks racing %s ownership', async kind => {
    const f = fixture(); f.tx[kind].findFirst.mockResolvedValue({ id: 'other' });
    await expect(f.handler.execute(cmd)).rejects.toMatchObject({ response: { code: 'details_unavailable' } });
    expect(f.tx.client.create).not.toHaveBeenCalled();
  });
  it('maps unique race to safe conflict', async () => {
    const f = fixture(); f.tx.client.create.mockRejectedValue({ code: 'P2002', message: 'private' });
    await expect(f.handler.execute(cmd)).rejects.toMatchObject({ response: { code: 'details_unavailable' } });
  });
  it('rejects expired/consumed continuation', async () => {
    const f = fixture(); f.store.lockContinuation.mockResolvedValue(null);
    await expect(f.handler.execute(cmd)).rejects.toMatchObject({ response: { code: 'invalid_or_expired_flow' } });
  });
  it.each([{ firstName: ' ' }, { lastName: 'a'.repeat(101) }, { email: 'invalid' }, { privacyAccepted: false }])('rejects invalid details %#', async change => {
    const f = fixture();
    await expect(f.handler.execute({ ...cmd, ...change } as never)).rejects.toMatchObject({ response: { code: 'invalid_details' } });
    expect(f.tx.client.create).not.toHaveBeenCalled();
  });
});
