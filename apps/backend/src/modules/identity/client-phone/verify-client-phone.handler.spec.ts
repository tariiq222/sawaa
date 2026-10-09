import * as bcrypt from 'bcryptjs';
import { Logger } from '@nestjs/common';
import { VerifyClientPhoneHandler } from './verify-client-phone.handler';

const NEW_PHONE = '+966512345678';

async function fixture(opts: { client?: Record<string, unknown>; otherClient?: boolean; otherUser?: boolean; linked?: Record<string, unknown> | null } = {}) {
  const client = { id: 'client-1', userId: null, phone: '+966500000001', email: null, emailVerified: null, tokenVersion: 3, isActive: true, deletedAt: null, ...opts.client };
  const challenge = { id: 'ch-1', clientId: 'client-1', phone: NEW_PHONE, codeHash: await bcrypt.hash('012345', 4), expiresAt: new Date(Date.now() + 60000), attempts: 0, consumedAt: null as Date | null };
  const tx = {
    $queryRaw: jest.fn(),
    clientPhoneChallenge: {
      findUnique: jest.fn(async () => challenge),
      update: jest.fn(async ({ data }: any) => { if (data.attempts?.increment) challenge.attempts += data.attempts.increment; return challenge; }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    client: {
      findFirst: jest.fn(async () => (opts.otherClient ? { id: 'other' } : null)),
      update: jest.fn(async ({ data }: any) => ({ ...client, ...data, tokenVersion: client.tokenVersion + 1 })),
    },
    user: {
      findFirst: jest.fn(async () => (opts.otherUser ? { id: 'staff' } : null)),
      findUnique: jest.fn(async () => opts.linked ?? null),
      update: jest.fn(),
    },
    clientRefreshToken: { updateMany: jest.fn(async () => ({ count: 2 })) },
  };
  const store = { transaction: async (run: any) => run(tx), owner: jest.fn(async () => client) };
  const tokens = { issueTokenPair: jest.fn(async () => ({ accessToken: 'new-access', rawRefresh: 'new-refresh' })) };
  const handler = new VerifyClientPhoneHandler(store as never, tokens as never);
  return { client, challenge, tx, tokens, handler };
}

describe('VerifyClientPhoneHandler', () => {
  it('adopts the new number, bumps tokenVersion, revokes every refresh token and returns fresh tokens', async () => {
    const f = await fixture();
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      expect(await f.handler.execute('client-1', { challengeId: 'ch-1', code: '012345' }))
        .toEqual({ phone: NEW_PHONE, tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } });
      expect(f.tx.client.update).toHaveBeenCalledWith({ where: { id: 'client-1' }, data: { phone: NEW_PHONE, phoneVerified: expect.any(Date), tokenVersion: { increment: 1 } } });
      expect(f.tx.clientRefreshToken.updateMany).toHaveBeenCalledWith({ where: { clientId: 'client-1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
      expect(f.tokens.issueTokenPair).toHaveBeenCalledWith(expect.objectContaining({ id: 'client-1', tokenVersion: 4 }), f.tx);
      expect(log).toHaveBeenCalledWith({ event: 'client_phone.changed', clientId: 'client-1' });
      expect(JSON.stringify(log.mock.calls)).not.toContain('966');
    } finally { log.mockRestore(); }
  });

  it.each([
    ['another live client holds the number', { otherClient: true }],
    ['a staff/other user holds the number', { otherUser: true }],
    ['the linked user is not a CLIENT login', { client: { userId: 'u-1' }, linked: { id: 'u-1', role: 'EMPLOYEE' } }],
  ])('refuses with 409 when %s', async (_name, opts) => {
    const f = await fixture(opts as never);
    await expect(f.handler.execute('client-1', { challengeId: 'ch-1', code: '012345' })).rejects.toMatchObject({ status: 409, response: { code: 'details_unavailable' } });
    expect(f.tx.client.update).not.toHaveBeenCalled();
    expect(f.tx.clientRefreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('updates the linked CLIENT user phone too', async () => {
    const f = await fixture({ client: { userId: 'u-1' }, linked: { id: 'u-1', role: 'CLIENT' } });
    await f.handler.execute('client-1', { challengeId: 'ch-1', code: '012345' });
    expect(f.tx.user.update).toHaveBeenCalledWith({ where: { id: 'u-1' }, data: { phone: NEW_PHONE, phoneVerifiedAt: expect.any(Date) } });
  });

  it('commits wrong attempts and caps the challenge at five', async () => {
    const f = await fixture();
    for (let i = 0; i < 5; i++) {
      await expect(f.handler.execute('client-1', { challengeId: 'ch-1', code: '999999' })).rejects.toMatchObject({ status: 400, response: { code: 'invalid_or_expired_code' } });
    }
    expect(f.challenge.attempts).toBe(5);
    await expect(f.handler.execute('client-1', { challengeId: 'ch-1', code: '012345' })).rejects.toMatchObject({ status: 400 });
    expect(f.tx.client.update).not.toHaveBeenCalled();
  });

  it('rejects a challenge that belongs to another client', async () => {
    const f = await fixture();
    f.challenge.clientId = 'victim';
    await expect(f.handler.execute('client-1', { challengeId: 'ch-1', code: '012345' })).rejects.toMatchObject({ status: 400 });
    expect(f.tx.client.update).not.toHaveBeenCalled();
  });

  it.each(['P2002', 'P2034'])('maps %s during the change to 409', async code => {
    const f = await fixture();
    f.tx.client.update.mockRejectedValueOnce({ code });
    await expect(f.handler.execute('client-1', { challengeId: 'ch-1', code: '012345' })).rejects.toMatchObject({ status: 409, response: { code: 'details_unavailable' } });
  });
});
