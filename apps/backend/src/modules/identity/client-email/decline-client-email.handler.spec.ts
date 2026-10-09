import { Logger } from '@nestjs/common';
import { ClientEmailStore } from './client-email.store';
import { DeclineClientEmailHandler } from './decline-client-email.handler';

type ClientRow = {
  id: string; isActive: boolean; deletedAt: Date | null; email: string | null;
  emailVerified: Date | null; pendingEmail: string | null; emailPromptResolvedAt: Date | null; userId: string | null;
};
type ChallengeRow = { id: string; clientId: string; email: string; codeHash: string; expiresAt: Date; attempts: number; consumedAt: Date | null };

function baseClient(overrides: Partial<ClientRow> = {}): ClientRow {
  return { id: 'client-a', isActive: true, deletedAt: null, email: 'legacy@example.test', emailVerified: null, pendingEmail: null, emailPromptResolvedAt: null, userId: null, ...overrides };
}

function fixture(client: ClientRow = baseClient()) {
  const clients = [client];
  const challenges: ChallengeRow[] = [{
    id: 'challenge-1', clientId: 'client-a', email: 'new@example.test', codeHash: 'hash',
    expiresAt: new Date(Date.now() + 300000), attempts: 0, consumedAt: null,
  }];
  const tx = {
    $queryRaw: jest.fn(async () => []),
    client: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => clients.find(c => c.id === where.id) ?? null),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = clients.find(c => c.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    clientEmailChallenge: {
      updateMany: jest.fn(async ({ where, data }: { where: { clientId?: string }; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of challenges) {
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
  const handler = new DeclineClientEmailHandler(store, prisma as never);
  return { client, challenges, tx, handler };
}

describe('DeclineClientEmailHandler', () => {
  it('drops the unverified legacy email, resolves the prompt and voids open challenges', async () => {
    const f = fixture(baseClient({ pendingEmail: 'new@example.test' }));
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    try {
      const result = await f.handler.execute('client-a');
      expect(result).toEqual({ status: 'none', email: null, pendingEmail: null, prompt: false });
      expect(f.client.email).toBeNull();
      expect(f.client.pendingEmail).toBeNull();
      expect(f.client.emailPromptResolvedAt).toBeInstanceOf(Date);
      expect(f.challenges[0].consumedAt).toBeInstanceOf(Date);
      expect(log).toHaveBeenCalledWith({ event: 'client_email.declined', clientId: 'client-a' });
    } finally { log.mockRestore(); }
  });

  it('refuses to drop a verified email', async () => {
    const f = fixture(baseClient({ email: 'kept@example.test', emailVerified: new Date() }));
    await expect(f.handler.execute('client-a')).rejects.toMatchObject({ status: 409, response: { code: 'email_verified' } });
    expect(f.client.email).toBe('kept@example.test');
    expect(f.client.emailPromptResolvedAt).toBeNull();
    expect(f.challenges[0].consumedAt).toBeNull();
  });

  it('clears a pending email even when no legacy email exists', async () => {
    const f = fixture(baseClient({ email: null, pendingEmail: 'new@example.test' }));
    const result = await f.handler.execute('client-a');
    expect(result).toEqual({ status: 'none', email: null, pendingEmail: null, prompt: false });
  });
});
