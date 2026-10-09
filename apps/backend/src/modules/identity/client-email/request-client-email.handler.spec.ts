import * as bcrypt from 'bcryptjs';
import { ServiceUnavailableException } from '@nestjs/common';
import { ClientEmailStore } from './client-email.store';
import { RequestClientEmailHandler } from './request-client-email.handler';

type ClientRow = {
  id: string; isActive: boolean; deletedAt: Date | null; email: string | null;
  emailVerified: Date | null; pendingEmail: string | null; emailPromptResolvedAt: Date | null; userId: string | null;
};
type ChallengeRow = { id: string; clientId: string; email: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null };

function baseClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return { id: 'client-a', isActive: true, deletedAt: null, email: null, emailVerified: null, pendingEmail: null, emailPromptResolvedAt: null, userId: null, ...overrides };
}

function fixture(client: ClientRow = baseClient(), otherClients: ClientRow[] = []) {
  const clients = [client, ...otherClients];
  const challenges: ChallengeRow[] = [];
  const tx = {
    $queryRaw: jest.fn(async () => []),
    client: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => clients.find(c => c.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: { where: { email?: { equals: string }; id?: { not: string } } }) => clients.filter(c =>
        c.id !== where.id?.not && (!where.email || (c.email ?? '').toLowerCase() === where.email.equals.toLowerCase()))),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = clients.find(c => c.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    clientEmailChallenge: {
      create: jest.fn(async ({ data }: { data: Omit<ChallengeRow, 'id'> }) => {
        const row: ChallengeRow = { id: `challenge-${challenges.length + 1}`, ...data };
        challenges.push(row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => challenges.find(c => c.id === where.id) ?? null),
      updateMany: jest.fn(async ({ where, data }: { where: { clientId?: string; id?: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of challenges) {
          if (where.id && row.id !== where.id) continue;
          if (where.clientId && row.clientId !== where.clientId) continue;
          if (row.consumedAt) continue;
          Object.assign(row, data);
          count++;
        }
        return { count };
      }),
    },
  };
  const transactions = { withTransaction: async (fn: (value: typeof tx) => unknown) => fn(tx) };
  const store = new ClientEmailStore(transactions as never);
  let sentCode = '';
  const delivery = { send: jest.fn(async (_channel: string, _target: string, code: string) => { sentCode = code; }) };
  const limiter = { reserve: jest.fn(async () => ({ key: 'key', id: 'id' })), settle: jest.fn() };
  const handler = new RequestClientEmailHandler(store, delivery as never, limiter as never);
  return { client, clients, challenges, tx, delivery, limiter, handler, code: () => sentCode };
}

describe('RequestClientEmailHandler', () => {
  it('stores a bcrypt-hashed six-digit code, sets pendingEmail and invalidates previous challenges', async () => {
    const f = fixture();
    const first = await f.handler.execute('client-a', { email: 'first@example.test' });
    const second = await f.handler.execute('client-a', { email: 'second@example.test' });
    expect(f.challenges[0].consumedAt).toBeInstanceOf(Date);
    expect(f.client.pendingEmail).toBe('second@example.test');
    expect(f.challenges[1].email).toBe('second@example.test');
    expect(f.challenges[1].codeHash).not.toBe(f.code());
    expect(await bcrypt.compare(f.code(), String(f.challenges[1].codeHash))).toBe(true);
    expect(/^\d{6}$/.test(f.code())).toBe(true);
    expect(second).toMatchObject({ maskedEmail: 's***@example.test', expiresIn: 300, retryAfterSeconds: 60 });
    expect(second.challengeId).toBe(f.challenges[1].id);
  });

  it('rejects an invalid email with the machine code', async () => {
    const f = fixture();
    await expect(f.handler.execute('client-a', { email: 'not-an-email' })).rejects.toMatchObject({ status: 400, response: { code: 'invalid_email' } });
    expect(f.challenges).toHaveLength(0);
  });

  it('rejects requesting the already verified email (case-insensitive)', async () => {
    const f = fixture(baseClient({ email: 'kept@example.test', emailVerified: new Date() }));
    await expect(f.handler.execute('client-a', { email: ' KEPT@Example.Test ' })).rejects.toMatchObject({ status: 400, response: { code: 'email_unchanged' } });
    expect(f.challenges).toHaveLength(0);
    expect(f.limiter.reserve).not.toHaveBeenCalled();
  });

  it('allows requesting the current unverified legacy email and performs no ownership check', async () => {
    const other = baseClient({ id: 'client-b', email: 'shared@example.test', emailVerified: null });
    const f = fixture(baseClient({ email: 'legacy@example.test' }), [other]);
    await expect(f.handler.execute('client-a', { email: 'shared@example.test' })).resolves.toBeTruthy();
    // No availability probe of other clients at request time (no enumeration).
    expect(f.tx.client.findMany).not.toHaveBeenCalled();
    expect(f.tx.client.findUnique).not.toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ email: expect.anything() }) }));
  });

  it('limits both the destination address and the requesting client', async () => {
    const f = fixture();
    await f.handler.execute('client-a', { email: 'new@example.test' });
    expect(f.limiter.reserve).toHaveBeenCalledWith('EMAIL', 'new@example.test');
    expect(f.limiter.reserve).toHaveBeenCalledWith('EMAIL', 'client-email:client-a');
    expect(f.limiter.settle).toHaveBeenCalledWith({ key: 'key', id: 'id' }, 'accepted');
  });

  it('voids the challenge and reports 503 when delivery fails', async () => {
    const f = fixture();
    f.delivery.send.mockRejectedValueOnce(new Error('provider down'));
    await expect(f.handler.execute('client-a', { email: 'new@example.test' })).rejects.toMatchObject({ status: 503, response: { code: 'delivery_unavailable' } });
    expect(f.challenges[0].consumedAt).toBeInstanceOf(Date);
    expect(f.client.pendingEmail).toBe('new@example.test');
  });

  it('releases limiter budget when challenge creation fails', async () => {
    const f = fixture(baseClient({ email: 'kept@example.test', emailVerified: new Date() }));
    // The post-reserve ownership re-read flips to email_unchanged, failing creation.
    let reads = 0;
    const flipped = baseClient({ email: 'new@example.test', emailVerified: new Date() });
    f.tx.client.findUnique.mockImplementation(async () => { reads += 1; return reads === 1 ? f.client : flipped; });
    await expect(f.handler.execute('client-a', { email: 'new@example.test' })).rejects.toMatchObject({ status: 400, response: { code: 'email_unchanged' } });
    expect(f.limiter.settle).toHaveBeenCalledWith({ key: 'key', id: 'id' }, 'rejected');
  });

  it('reports 503 without a challenge when the limiter rejects the destination', async () => {
    const f = fixture();
    f.limiter.reserve.mockRejectedValueOnce(new ServiceUnavailableException({ code: 'delivery_unavailable' }));
    await expect(f.handler.execute('client-a', { email: 'new@example.test' })).rejects.toMatchObject({ status: 503 });
    expect(f.challenges).toHaveLength(0);
  });
});
