import { PgClientAccountStore } from './client-account.store';
import type { Prisma } from '@prisma/client';

type MockTx = {
  client: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  passwordHistory: {
    create: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  $queryRaw: jest.Mock;
};

const row = {
  id: 'client-1',
  userId: 'user-1',
  email: 'a@b.com',
  emailVerified: new Date('2026-01-01'),
  phone: '+966500000001',
  phoneVerified: new Date('2026-01-02'),
  passwordHash: 'hash',
  tokenVersion: 3,
  isActive: true,
  deletedAt: null,
  loginAttempts: 1,
  lockoutUntil: null,
  lastLoginAt: new Date('2026-01-03'),
};

const buildTx = (): MockTx => ({
  client: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  passwordHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
});

describe('PgClientAccountStore', () => {
  let store: PgClientAccountStore;
  let tx: MockTx;

  beforeEach(() => {
    store = new PgClientAccountStore();
    tx = buildTx();
  });

  const asTx = () => tx as unknown as Prisma.TransactionClient;

  describe('findByIdentifier', () => {
    it('scopes the lookup to one identifier and excludes deleted clients', async () => {
      tx.client.findFirst.mockResolvedValue(row);
      const result = await store.findByIdentifier(asTx(), { email: 'a@b.com' });
      expect(tx.client.findFirst).toHaveBeenCalledWith({
        where: { email: 'a@b.com', deletedAt: null },
        select: expect.any(Object),
      });
      expect(result).toEqual(
        expect.objectContaining({ id: 'client-1', tokenVersion: 3 }),
      );
    });

    it('returns null for an unknown identifier', async () => {
      tx.client.findFirst.mockResolvedValue(null);
      await expect(
        store.findByIdentifier(asTx(), { phone: '+966500000009' }),
      ).resolves.toBeNull();
    });

    it('does not leak profile or consent fields outside the auth projection', async () => {
      tx.client.findFirst.mockResolvedValue(row);
      const result = await store.findByIdentifier(asTx(), {
        email: 'a@b.com',
      });
      expect(result).not.toHaveProperty('nationalId');
      expect(result).not.toHaveProperty('consentedAt');
      expect(result).not.toHaveProperty('notes');
    });
  });

  describe('lockForAuth', () => {
    it('takes a row lock before reading the client back', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: 'client-1' }]);
      tx.client.findUnique.mockResolvedValue(row);

      const result = await store.lockForAuth(asTx(), 'client-1');

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      // Prisma.sql returns a Sql object: the raw text lives on `.sql`.
      const lockedQuery = (tx.$queryRaw.mock.calls[0] as unknown[])[0] as { sql: string };
      expect(lockedQuery.sql).toContain('FOR UPDATE');
      expect(lockedQuery.sql).toContain('"Client"');
      expect(tx.client.findUnique).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        select: expect.any(Object),
      });
      expect(result?.id).toBe('client-1');
    });

    it('returns null when the row disappears after the lock', async () => {
      tx.$queryRaw.mockResolvedValue([]);
      tx.client.findUnique.mockResolvedValue(null);
      await expect(store.lockForAuth(asTx(), 'gone')).resolves.toBeNull();
    });
  });

  describe('createRegisteredClient', () => {
    it('creates a FULL client with named fields only', async () => {
      tx.client.create.mockResolvedValue(row);
      await store.createRegisteredClient(asTx(), {
        email: 'a@b.com',
        phone: null,
        name: 'Ahmed',
        passwordHash: 'hash',
        emailVerified: new Date('2026-01-01'),
        phoneVerified: null,
        consentedAt: new Date('2026-01-05'),
        consentVersion: 'v1',
      });

      const call = tx.client.create.mock.calls[0][0];
      expect(call.data).toMatchObject({
        email: 'a@b.com',
        name: 'Ahmed',
        accountType: 'FULL',
        consentVersion: 'v1',
      });
      expect(call.data).not.toHaveProperty('nationalId');
    });
  });

  describe('setPasswordHash', () => {
    it('updates exactly one column', async () => {
      tx.client.update.mockResolvedValue({ id: 'client-1' });
      await store.setPasswordHash(asTx(), 'client-1', 'new-hash');
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { passwordHash: 'new-hash' },
        select: { id: true },
      });
    });
  });

  describe('bumpTokenVersion', () => {
    it('increments the token version and returns the new value', async () => {
      tx.client.update.mockResolvedValue({ tokenVersion: 4 });
      await expect(store.bumpTokenVersion(asTx(), 'client-1')).resolves.toBe(4);
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { tokenVersion: { increment: 1 } },
        select: { tokenVersion: true },
      });
    });
  });

  describe('recordFailedLogin', () => {
    it('sets a lockout when one is provided', async () => {
      tx.client.update.mockResolvedValue({ id: 'client-1' });
      const lockoutUntil = new Date('2026-01-01T00:15:00Z');
      await store.recordFailedLogin(asTx(), 'client-1', {
        attempts: 5,
        lockoutUntil,
      });
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: { loginAttempts: 5, lockoutUntil },
        select: { id: true },
      });
    });

    it('leaves lockoutUntil untouched when the caller passes undefined', async () => {
      tx.client.update.mockResolvedValue({ id: 'client-1' });
      await store.recordFailedLogin(asTx(), 'client-1', {
        attempts: 2,
        lockoutUntil: undefined,
      });
      const data = (tx.client.update.mock.calls[0][0] as { data: object }).data;
      expect(data).toEqual({ loginAttempts: 2 });
      expect(data).not.toHaveProperty('lockoutUntil');
    });
  });

  describe('email proof', () => {
    it('promotes the pending email and clears the prompt state', async () => {
      tx.client.update.mockResolvedValue({ id: 'client-1' });
      const verifiedAt = new Date('2026-01-06');
      await store.setEmailProof(asTx(), 'client-1', {
        email: 'new@b.com',
        verifiedAt,
      });
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          email: 'new@b.com',
          emailVerified: verifiedAt,
          pendingEmail: null,
          emailPromptResolvedAt: verifiedAt,
        },
        select: { id: true },
      });
    });

    it('clears proof and pending email without touching the stored address', async () => {
      tx.client.update.mockResolvedValue({ id: 'client-1' });
      await store.clearEmailProof(asTx(), 'client-1');
      const data = (tx.client.update.mock.calls[0][0] as { data: object }).data;
      expect(data).toEqual({ emailVerified: null, pendingEmail: null });
      expect(data).not.toHaveProperty('email');
    });
  });

  describe('anonymizeForDeletion', () => {
    it('kills sessions and identifiers in one write', async () => {
      tx.client.update.mockResolvedValue({ id: 'client-1' });
      const at = new Date('2026-01-07');
      await store.anonymizeForDeletion(asTx(), 'client-1', at);
      expect(tx.client.update).toHaveBeenCalledWith({
        where: { id: 'client-1' },
        data: {
          deletedAt: at,
          isActive: false,
          email: null,
          phone: null,
          emailVerified: null,
          phoneVerified: null,
          pendingEmail: null,
          emailPromptResolvedAt: null,
          // Full PDPL anonymization. Owner-approved widening (2026-11-21):
          // the legacy closure write did NOT clear pendingEmail and
          // emailPromptResolvedAt; the store intentionally does, so an
          // unverified pending address never outlives the account.
          nationalId: null,
          emergencyName: null,
          emergencyPhone: null,
          avatarUrl: null,
          pushEnabled: false,
          passwordHash: null,
          tokenVersion: { increment: 1 },
        },
        select: { id: true },
      });
    });
  });

  describe('password history', () => {
    it('records the hash and trims past the retention depth', async () => {
      tx.passwordHistory.create.mockResolvedValue({ id: 'ph-1' });
      tx.passwordHistory.findMany.mockResolvedValue([{ id: 'old-1' }]);
      tx.passwordHistory.deleteMany.mockResolvedValue({ count: 1 });

      await store.recordPasswordHistory(asTx(), 'client-1', 'hash', 5);

      expect(tx.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        orderBy: { createdAt: 'desc' },
        skip: 5,
        select: { id: true },
      });
      expect(tx.passwordHistory.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old-1'] } },
      });
    });

    it('does not delete anything when the history is within depth', async () => {
      tx.passwordHistory.create.mockResolvedValue({ id: 'ph-1' });
      tx.passwordHistory.findMany.mockResolvedValue([]);
      await store.recordPasswordHistory(asTx(), 'client-1', 'hash', 5);
      expect(tx.passwordHistory.deleteMany).not.toHaveBeenCalled();
    });

    it('returns hashes newest-first with the requested limit', async () => {
      tx.passwordHistory.findMany.mockResolvedValue([
        { passwordHash: 'h1' },
        { passwordHash: 'h2' },
      ]);
      await expect(
        store.listRecentPasswordHashes(asTx(), 'client-1', 5),
      ).resolves.toEqual(['h1', 'h2']);
      expect(tx.passwordHistory.findMany).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { passwordHash: true },
      });
    });
  });
});
