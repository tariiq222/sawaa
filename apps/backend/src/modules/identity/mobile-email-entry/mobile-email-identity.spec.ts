import { MobileEmailIdentity } from './mobile-email-identity';
const now = new Date('2026-10-06');
const user = { id: 'u', email: 'person@example.test', phone: '+966512345678', role: 'CLIENT', isSuperAdmin: false, isActive: true, emailVerifiedAt: now, phoneVerifiedAt: now, tokenVersion: 1, updatedAt: now };
const client = { id: 'c', userId: 'u', email: 'person@example.test', phone: user.phone, isActive: true, deletedAt: null, emailVerified: now, phoneVerified: now, tokenVersion: 1, updatedAt: now };
describe('MobileEmailIdentity', () => {
  it.each([
    ['unknown', [], [], 'register'],
    ['verified', [user], [client], 'client'],
    ['legacy null email', [user], [{ ...client, email: null }], 'client'],
    ['unverified client contact alone', [user], [{ ...client, emailVerified: null }], 'client'],
    ['unverified', [{ ...user, emailVerifiedAt: null }], [client], 'link'],
    ['disabled user', [{ ...user, isActive: false }], [client], 'unavailable'],
    ['deleted client', [user], [{ ...client, deletedAt: now }], 'unavailable'],
    ['client only', [], [client], 'unavailable'],
    ['divergent email', [user], [{ ...client, email: 'other@example.test' }], 'unavailable'],
    ['divergent phone', [{ ...user, emailVerifiedAt: null }], [{ ...client, phone: '+966512345679' }], 'unavailable'],
    ['duplicate users', [user, { ...user, id: 'u2' }], [client], 'unavailable'],
    ['staff without practitioner', [{ ...user, role: 'ADMIN' }], [], 'unavailable'],
    ['unverified staff', [{ ...user, role: 'ADMIN', emailVerifiedAt: null }], [], 'unavailable'],
  ])('%s', async (_name, users, clients, expected) => {
    const tx = { user: { findMany: async () => users }, client: { findMany: async () => clients }, employee: { findFirst: async () => null }, $queryRaw: async () => [] };
    const identity = new MobileEmailIdentity({ get: async () => false } as never);
    expect((await identity.classify(tx as never, user.email)).kind).toBe(expected);
  });
  it('refuses an otherwise valid link when another identity owns its phone', async () => {
    const tx = { user: { findMany: async ({ where }: any) => where.phone ? [{ ...user, id: 'other' }] : [{ ...user, emailVerifiedAt: null }] }, client: { findMany: async () => [client] }, $queryRaw: async () => [] };
    const identity = new MobileEmailIdentity({} as never);
    expect((await identity.classify(tx as never, user.email)).kind).toBe('unavailable');
  });
  it('detects an away-and-back change via updatedAt in the bound snapshot', () => {
    const identity = new MobileEmailIdentity({} as never);
    expect(identity.snapshot(user as never, client as never)).not.toEqual(identity.snapshot({ ...user, updatedAt: new Date(now.getTime() + 1) } as never, client as never));
  });
});
