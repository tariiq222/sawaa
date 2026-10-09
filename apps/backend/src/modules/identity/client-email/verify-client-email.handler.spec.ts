import * as bcrypt from 'bcryptjs';
import { Logger } from '@nestjs/common';
import { ClientEmailStore } from './client-email.store';
import { VerifyClientEmailHandler } from './verify-client-email.handler';

type ClientRow = {
  id: string; isActive: boolean; deletedAt: Date | null; email: string | null;
  emailVerified: Date | null; pendingEmail: string | null; emailPromptResolvedAt: Date | null; userId: string | null;
};
type UserRow = { id: string; email: string; role: string; emailVerifiedAt: Date | null; isActive: boolean };
type ChallengeRow = { id: string; clientId: string; email: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null };

function baseClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return { id: 'client-a', isActive: true, deletedAt: null, email: null, emailVerified: null, pendingEmail: null, emailPromptResolvedAt: null, userId: null, ...overrides };
}

async function fixture(opts: { client?: ClientRow; others?: ClientRow[]; users?: UserRow[] } = {}) {
  const client = opts.client ?? baseClient();
  const clients = [client, ...(opts.others ?? [])];
  const users = opts.users ?? [];
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
      // Mirrors PostgreSQL re-evaluating the WHERE clause on the current row.
      updateMany: jest.fn(async ({ where, data }: { where: { id: string; emailVerified?: null; email?: { equals: string } }; data: Record<string, unknown> }) => {
        const row = clients.find(c => c.id === where.id);
        if (!row || row.deletedAt || (where.emailVerified === null && row.emailVerified !== null) ||
          (where.email && (row.email ?? '').toLowerCase() !== where.email.equals.toLowerCase())) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => users.find(u => u.id === where.id) ?? null),
      findFirst: jest.fn(async ({ where }: { where: { email: { equals: string }; id?: { not: string } } }) =>
        users.find(u => u.email.toLowerCase() === where.email.equals.toLowerCase() && u.id !== where.id?.not) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = users.find(u => u.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    clientEmailChallenge: {
      create: jest.fn(),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => challenges.find(c => c.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = challenges.find(c => c.id === where.id)!;
        if (data.attempts && typeof data.attempts === 'object' && 'increment' in data.attempts) row.attempts += (data.attempts as { increment: number }).increment;
        else Object.assign(row, data);
        return row;
      }),
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
  const prisma = { client: { findUnique: tx.client.findUnique } };
  const handler = new VerifyClientEmailHandler(store, prisma as never);
  async function challenge(email = 'new@example.test', clientId = 'client-a') {
    const row: ChallengeRow = {
      id: `challenge-${challenges.length + 1}`, clientId, email,
      codeHash: await bcrypt.hash('012345', 10), expiresAt: new Date(Date.now() + 300000), attempts: 0, consumedAt: null,
    };
    challenges.push(row);
    return row;
  }
  return { client, clients, users, challenges, tx, handler, challenge };
}

describe('VerifyClientEmailHandler', () => {
  it('promotes the verified email, clears pending state and consumes the challenge', async () => {
    const f = await fixture({ client: baseClient({ email: 'legacy@example.test', pendingEmail: 'new@example.test' }) });
    const challenge = await f.challenge();
    const result = await f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' });
    expect(result).toEqual({ status: 'verified', email: 'new@example.test', pendingEmail: null, prompt: false });
    expect(f.client.emailVerified).toBeInstanceOf(Date);
    expect(f.client.emailPromptResolvedAt).toBeInstanceOf(Date);
    expect(challenge.consumedAt).toBeInstanceOf(Date);
  });

  it('updates the linked CLIENT user email and verification timestamp too', async () => {
    const linked: UserRow = { id: 'user-a', email: 'old@example.test', role: 'CLIENT', emailVerifiedAt: null, isActive: true };
    const f = await fixture({ client: baseClient({ userId: 'user-a' }), users: [linked] });
    const challenge = await f.challenge();
    await f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' });
    expect(linked.email).toBe('new@example.test');
    expect(linked.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('releases another client unverified copy of the address with a structured log', async () => {
    const holder = baseClient({ id: 'client-b', email: 'new@example.test' });
    const f = await fixture({ others: [holder] });
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      const challenge = await f.challenge();
      await f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' });
      expect(holder.email).toBeNull();
      expect(log).toHaveBeenCalledWith({ event: 'client_email.unverified_released', clientId: 'client-a', releasedClientId: 'client-b' });
    } finally { log.mockRestore(); }
  });

  it('refuses when another live client holds the address verified', async () => {
    const holder = baseClient({ id: 'client-b', email: 'new@example.test', emailVerified: new Date() });
    const f = await fixture({ others: [holder] });
    const challenge = await f.challenge();
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 409, response: { code: 'details_unavailable' } });
    expect(f.client.email).toBeNull();
    expect(holder.email).toBe('new@example.test');
  });

  it('refuses when an unlinked User login identity already holds the address', async () => {
    const intruder: UserRow = { id: 'user-x', email: 'new@example.test', role: 'CLIENT', emailVerifiedAt: new Date(), isActive: true };
    const f = await fixture({ users: [intruder] });
    const challenge = await f.challenge();
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 409, response: { code: 'details_unavailable' } });
    expect(f.client.email).toBeNull();
  });

  it('refuses when the linked user exists but is not a CLIENT login identity', async () => {
    const linked: UserRow = { id: 'user-a', email: 'old@example.test', role: 'EMPLOYEE', emailVerifiedAt: null, isActive: true };
    const f = await fixture({ client: baseClient({ userId: 'user-a' }), users: [linked] });
    const challenge = await f.challenge();
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 409 });
    expect(f.client.email).toBeNull();
  });

  it('allows adopting the linked user own current address', async () => {
    const linked: UserRow = { id: 'user-a', email: 'new@example.test', role: 'CLIENT', emailVerifiedAt: null, isActive: true };
    const f = await fixture({ client: baseClient({ userId: 'user-a' }), users: [linked] });
    const challenge = await f.challenge();
    const result = await f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' });
    expect(result.status).toBe('verified');
    expect(linked.emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('rejects a challenge belonging to another client', async () => {
    const f = await fixture();
    const challenge = await f.challenge('new@example.test', 'client-b');
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 400, response: { code: 'invalid_or_expired_code' } });
    expect(f.client.email).toBeNull();
    expect(challenge.consumedAt).toBeNull();
  });

  it('commits wrong attempts before the 400 and caps the challenge at five', async () => {
    const f = await fixture();
    const challenge = await f.challenge();
    for (let i = 0; i < 5; i++) {
      await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '111111' })).rejects.toMatchObject({ status: 400 });
      expect(challenge.attempts).toBe(i + 1);
    }
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 400, response: { code: 'invalid_or_expired_code' } });
    expect(f.client.email).toBeNull();
  });

  it('rejects an expired or consumed challenge', async () => {
    const f = await fixture();
    const expired = await f.challenge();
    expired.expiresAt = new Date(0);
    await expect(f.handler.execute('client-a', { challengeId: expired.id, code: '012345' })).rejects.toMatchObject({ status: 400 });
    const consumed = await f.challenge();
    consumed.consumedAt = new Date();
    await expect(f.handler.execute('client-a', { challengeId: consumed.id, code: '012345' })).rejects.toMatchObject({ status: 400 });
    expect(f.client.email).toBeNull();
  });

  it('maps a unique-constraint failure to a 409 conflict', async () => {
    const f = await fixture();
    const challenge = await f.challenge();
    f.tx.client.update.mockRejectedValueOnce({ code: 'P2002' } as never);
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 409, response: { code: 'details_unavailable' } });
  });

  it('maps a deadlock abort to the same 409 conflict', async () => {
    const f = await fixture();
    const challenge = await f.challenge();
    f.tx.client.update.mockRejectedValueOnce({ code: 'P2034' } as never);
    await expect(f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' })).rejects.toMatchObject({ status: 409, response: { code: 'details_unavailable' } });
  });

  it('never clears a holder that verified or changed its email after the snapshot', async () => {
    const holder = baseClient({ id: 'client-b', email: 'new@example.test' });
    const f = await fixture({ others: [holder] });
    // Simulate the race: the holder commits a verified, different address
    // between the holder snapshot and the release write.
    f.tx.client.findMany.mockImplementationOnce(async () => {
      const snapshot = [{ ...holder }];
      holder.email = 'other@example.test';
      holder.emailVerified = new Date();
      return snapshot;
    });
    const challenge = await f.challenge();
    await f.handler.execute('client-a', { challengeId: challenge.id, code: '012345' });
    expect(holder).toMatchObject({ email: 'other@example.test', emailVerified: expect.any(Date) });
  });
});
