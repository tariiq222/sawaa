import { Logger } from '@nestjs/common';
import { VerifyPhoneEntryHandler } from './verify-phone-entry.handler';

describe('VerifyPhoneEntryHandler', () => {
  function fixture() {
    const client = { id: 'c', userId: null, isActive: true, email: 'legacy@example.test', emailVerified: null, emailPromptResolvedAt: null, phoneVerified: null, lastLoginAt: null, accountType: 'WALK_IN' };
    const tx = { user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() }, client: { findMany: jest.fn().mockResolvedValue([client]), update: jest.fn().mockResolvedValue(client) }, mobilePhoneEntryFlow: { update: jest.fn() } };
    const store = { transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx), lock: jest.fn().mockResolvedValue({ id: 'f', phone: '+966512345678', state: 'CODE_PENDING', createdAt: new Date() }), liveFlow: () => true, checkCode: jest.fn().mockResolvedValue(true), consume: jest.fn().mockResolvedValue(true) };
    const tokens = { issueTokenPair: jest.fn().mockResolvedValue({ accessToken: 'a', rawRefresh: 'r' }) };
    return { handler: new VerifyPhoneEntryHandler(store as never, tokens as never), tx, store, tokens, client };
  }
  it('classifies only after proof and consumes before issuing client tokens', async () => {
    const f = fixture();
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toMatchObject({ next: 'authenticated', emailPrompt: true, sessionKind: 'client' });
    expect(f.store.checkCode.mock.invocationCallOrder[0]).toBeLessThan(f.tx.user.findMany.mock.invocationCallOrder[0]);
    expect(f.store.consume.mock.invocationCallOrder[0]).toBeLessThan(f.tokens.issueTokenPair.mock.invocationCallOrder[0]);
    expect(f.tx.client.update.mock.calls[0][0].data).not.toHaveProperty('claimedAt');
  });
  it('logs first claim with client id only and no contact/name data', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      await fixture().handler.execute({ challengeId: 'f', code: '123456' });
      expect(log).toHaveBeenCalledWith({ event: 'mobile_phone_entry.first_claim', clientId: 'c' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('example.test');
      expect(JSON.stringify(log.mock.calls)).not.toContain('+966');
    } finally { log.mockRestore(); }
  });
  it('rejects a second consumption before issuing tokens', async () => {
    const f = fixture(); f.store.consume.mockResolvedValue(false);
    await expect(f.handler.execute({ challengeId: 'f', code: '123456' })).rejects.toMatchObject({ response: { code: 'invalid_or_expired_flow' } });
    expect(f.tokens.issueTokenPair).not.toHaveBeenCalled();
  });
  it.each(['staff', 'inactive', 'duplicate', 'broken-link'])('rejects %s without session', async kind => {
    const f = fixture();
    if (kind === 'staff') f.tx.user.findMany.mockResolvedValue([{ role: 'ADMIN' }]);
    if (kind === 'inactive') f.client.isActive = false;
    if (kind === 'duplicate') f.tx.client.findMany.mockResolvedValue([f.client, f.client]);
    if (kind === 'broken-link') Object.assign(f.client, { userId: 'u' });
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toEqual({ next: 'unavailable' });
    expect(f.tokens.issueTokenPair).not.toHaveBeenCalled();
  });
  it('commits code sentinel without identity reads', async () => {
    const f = fixture(); f.store.checkCode.mockResolvedValue(false);
    await expect(f.handler.execute({ challengeId: 'f', code: '000000' })).rejects.toMatchObject({ response: { code: 'invalid_or_expired_code' } });
    expect(f.tx.client.findMany).not.toHaveBeenCalled();
  });
  it('new phone binds a hashed continuation without creating or issuing a session', async () => {
    const f = fixture(); f.tx.client.findMany.mockResolvedValue([]);
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toMatchObject({ next: 'register', expiresIn: 600, continuationToken: expect.any(String) });
    expect(f.tx.mobilePhoneEntryFlow.update.mock.calls[0][0].data).toMatchObject({ state: 'DETAILS_PENDING', codeHash: null, continuationHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(f.tokens.issueTokenPair).not.toHaveBeenCalled();
  });
  it.each([{ emailVerified: new Date() }, { email: '' }, { emailPromptResolvedAt: new Date() }])('does not prompt when rule excludes client %#', async change => {
    const f = fixture(); Object.assign(f.client, change);
    expect(await f.handler.execute({ challengeId: 'f', code: '123456' })).toMatchObject({ emailPrompt: false });
  });
});
