/** Real PostgreSQL + Redis proof/identity tests; email/SMS leave only in-memory captures. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { AuthenticaClient } from '../../../src/infrastructure/authentica';
import { EmailChannelAdapter } from '../../../src/modules/comms/notification-channel/email-channel.adapter';
import { SmsChannelAdapter } from '../../../src/modules/comms/notification-channel/sms-channel.adapter';
import { PlatformSettingsService } from '../../../src/modules/platform/settings/platform-settings.service';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
const root = '/api/v1/mobile/auth/email-entry';

describeReal('Mobile email entry — real proof and identity boundaries', () => {
  jest.setTimeout(90_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  const prefix = `email-entry-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const codes = new Map<string, string>();
  const users = new Set<string>();
  const clients = new Set<string>();
  const requestedEmails = new Set<string>();
  const rejectedEmails = new Set<string>();
  const rejectedPhones = new Set<string>();
  const address = () => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
  const phone = () => `+96655${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const api = () => request(app.getHttpServer());
  const post = (path: string, body: object) => api().post(`${root}/${path}`).send(body);

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    // E2E global setup mocks Redis for old suites; this suite deliberately exercises real Lua/limits.
    const ActualRedis = jest.requireActual<typeof import('ioredis')>('ioredis').default;
    redis = new ActualRedis({
      host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT ?? 6379),
      db: Number(process.env.REDIS_DB ?? 13), password: process.env.REDIS_PASSWORD || undefined,
    });
    await redis.ping();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue({ getClient: () => redis })
      .overrideProvider(AuthenticaClient).useValue({ isConfigured: () => true })
      .overrideProvider(EmailChannelAdapter).useValue({ kind: 'EMAIL', send: async (email: string, code: string) => {
        if (rejectedEmails.has(email)) throw new Error('synthetic email rejection');
        codes.set(email, code);
      } })
      .overrideProvider(SmsChannelAdapter).useValue({ kind: 'SMS', send: async (number: string, code: string) => {
        if (rejectedPhones.has(number)) throw new Error('synthetic SMS rejection');
        codes.set(number, code);
      } }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureHttpContract(app, 'production');
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (prisma) {
      const foundUsers = await prisma.user.findMany({ where: { email: { startsWith: prefix, mode: 'insensitive' } }, select: { id: true } });
      foundUsers.forEach(x => users.add(x.id));
      const foundClients = await prisma.client.findMany({ where: { OR: [{ email: { startsWith: prefix, mode: 'insensitive' } }, { userId: { in: [...users] } }] }, select: { id: true } });
      foundClients.forEach(x => clients.add(x.id));
      // Only this run's synthetic data; do not flush Redis or clear unrelated database rows.
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: [...clients] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: [...users] } } });
      await prisma.client.deleteMany({ where: { id: { in: [...clients] } } });
      await prisma.employee.deleteMany({ where: { userId: { in: [...users] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...users] } } });
      // Table may not exist in the initial red run, before the additive migration.
      for (const email of requestedEmails) await prisma.$executeRaw`DELETE FROM "MobileEmailFlow" WHERE email = ${email}`.catch(() => undefined);
    }
    if (app) await app.close();
    if (redis) await redis.quit();
  });

  async function account(opts: { verified?: boolean; active?: boolean; clientEmail?: string | null; role?: 'CLIENT' | 'EMPLOYEE' | 'ADMIN' } = {}) {
    const email = address(); const number = phone();
    const user = await prisma.user.create({ data: {
      email, phone: number, name: 'Synthetic email entry', firstName: 'Synthetic', lastName: 'Entry',
      role: opts.role ?? 'CLIENT', isActive: opts.active ?? true,
      emailVerifiedAt: opts.verified ? new Date() : null, phoneVerifiedAt: new Date(),
    } });
    users.add(user.id);
    if (user.role !== 'CLIENT') return { user, client: null, email, phone: number };
    const client = await prisma.client.create({ data: {
      userId: user.id, name: user.name, phone: number, phoneVerified: new Date(),
      email: opts.clientEmail === undefined ? email : opts.clientEmail,
      emailVerified: opts.verified ? new Date() : null, accountType: 'FULL',
    } });
    clients.add(client.id);
    return { user, client, email, phone: number };
  }
  async function challenge(email = address()) {
    requestedEmails.add(email);
    const result = await post('request', { email }).expect(200);
    expect(result.headers['cache-control']).toContain('no-store');
    expect(codes.get(email)).toMatch(/^\d{6}$/);
    return { ...result.body, email, code: codes.get(email)! };
  }
  async function proof(email = address()) {
    const c = await challenge(email);
    const result = await post('verify', { challengeId: c.challengeId, code: c.code }).expect(200);
    return { ...result.body, email };
  }
  async function phoneChallenge(p: { continuationToken: string }, number = phone(), register = false) {
    const result = await post('request-phone', {
      continuationToken: p.continuationToken, phone: number,
      ...(register ? { firstName: 'Synthetic', lastName: 'Entry', privacyAccepted: true } : {}),
    }).expect(200);
    expect(codes.get(number)).toMatch(/^\d{6}$/);
    return { ...result.body, phone: number, code: codes.get(number)! };
  }
  const finish = (p: { phoneChallengeId: string; continuationToken: string; code: string }) =>
    post('verify-phone', { phoneChallengeId: p.phoneChallengeId, continuationToken: p.continuationToken, code: p.code });
  // Test-clock boundary: expire only this synthetic identifier's cooldown,
  // retaining the real Redis hourly budget and every other flow's limits.
  async function expireCooldown(channel: 'EMAIL' | 'SMS', identifier: string) {
    const key = createHash('sha256').update(`${channel}:${identifier}`).digest('hex');
    await redis.pexpire(`mobile-email-send:{${key}}:cooldown`, 0);
  }

  it('issues the same real challenge contract for known and unknown email', async () => {
    const known = await account({ verified: true });
    const a = await challenge(known.email); const b = await challenge();
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a).not.toHaveProperty('next'); expect(b).not.toHaveProperty('tokens');
    expect(await prisma.clientRefreshToken.count({ where: { clientId: known.client!.id } })).toBe(0);
  });

  it('registers only after email and phone proof and records consent', async () => {
    const p = await proof();
    expect(p.next).toBe('register'); expect(p).not.toHaveProperty('tokens');
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(0);
    const sms = await phoneChallenge(p, phone(), true);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(0);
    const response = await finish(sms).expect(200);
    expect(response.body).toMatchObject({ next: 'authenticated', sessionKind: 'client' });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: p.email } });
    const client = await prisma.client.findFirstOrThrow({ where: { userId: user.id } });
    expect(user.role).toBe('CLIENT'); expect(user.isSuperAdmin).toBe(false);
    expect(user.emailVerifiedAt).not.toBeNull(); expect(user.phoneVerifiedAt).not.toBeNull();
    expect(client.email).toBe(p.email); expect(client.emailVerified).not.toBeNull();
    expect(client.phoneVerified).not.toBeNull(); expect(client.consentedAt).not.toBeNull();
    expect(client.consentVersion).toBeTruthy();
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${response.body.tokens.accessToken}`).expect(200);
    await finish(sms).expect(400);
  });

  it('links a legacy null Client email only after proving the registered phone', async () => {
    const f = await account({ clientEmail: null }); const p = await proof(f.email);
    expect(p.next).toBe('verify_phone'); expect(p).not.toHaveProperty('phone');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).emailVerifiedAt).toBeNull();
    await finish(await phoneChallenge(p, f.phone)).expect(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).emailVerifiedAt).not.toBeNull();
    const client = await prisma.client.findUniqueOrThrow({ where: { id: f.client!.id } });
    expect(client.email).toBe(f.email); expect(client.emailVerified).not.toBeNull();
  });

  it('authenticates an already verified account once under concurrent email submissions', async () => {
    const f = await account({ verified: true }); const c = await challenge(f.email);
    const results = await Promise.all(Array.from({ length: 5 }, () => post('verify', { challengeId: c.challengeId, code: c.code })));
    expect(results.filter(x => x.status === 200)).toHaveLength(1);
    expect(results.filter(x => x.status === 400)).toHaveLength(4);
    expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client!.id } })).toBe(1);
  });

  it('creates one account and session under concurrent correct phone submissions', async () => {
    const p = await proof(); const sms = await phoneChallenge(p, phone(), true);
    const results = await Promise.all(Array.from({ length: 5 }, () => finish(sms)));
    expect(results.filter(x => x.status === 200)).toHaveLength(1);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(1);
    const client = await prisma.client.findFirstOrThrow({ where: { email: p.email } });
    expect(await prisma.clientRefreshToken.count({ where: { clientId: client.id } })).toBe(1);
  });

  it('commits failed email attempts and rejects the correct code after five failures', async () => {
    const c = await challenge(); const wrong = c.code === '000000' ? '111111' : '000000';
    const results = await Promise.all(Array.from({ length: 5 }, () => post('verify', { challengeId: c.challengeId, code: wrong })));
    expect(results.every(x => x.status === 400)).toBe(true);
    await post('verify', { challengeId: c.challengeId, code: c.code }).expect(400);
  });

  it('does not reactivate disabled accounts or overwrite a different Client email', async () => {
    for (const f of [await account({ active: false }), await account({ clientEmail: address() })]) {
      expect((await proof(f.email)).next).toBe('unavailable');
      expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client!.id } })).toBe(0);
    }
  });

  it('invalidates a phone continuation after an identity edit even if contacts are restored', async () => {
    const f = await account(); const p = await proof(f.email); const sms = await phoneChallenge(p, f.phone);
    await prisma.user.update({ where: { id: f.user.id }, data: { phone: phone() } });
    await prisma.user.update({ where: { id: f.user.id }, data: { phone: f.phone } });
    expect((await finish(sms)).status).toBeGreaterThanOrEqual(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } })).emailVerifiedAt).toBeNull();
    expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client!.id } })).toBe(0);
  });

  it('does not adopt an existing phone account during registration', async () => {
    const existing = await account({ verified: true }); const p = await proof();
    await post('request-phone', { continuationToken: p.continuationToken, phone: existing.phone, firstName: 'New', lastName: 'Person', privacyAccepted: true }).expect(409);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(0);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: existing.client!.id } })).userId).toBe(existing.user.id);
  });

  it('requires explicit consent and rejects names in an existing-account link', async () => {
    const p = await proof();
    await post('request-phone', { continuationToken: p.continuationToken, phone: phone(), firstName: 'New', lastName: 'Person' }).expect(400);
    const f = await account(); const existing = await proof(f.email);
    await post('request-phone', { continuationToken: existing.continuationToken, phone: f.phone, firstName: 'Changed' }).expect(400);
  });

  it('surfaces failed email delivery and prevents immediate retry storms', async () => {
    const email = address(); requestedEmails.add(email); rejectedEmails.add(email);
    await post('request', { email }).expect(503);
    expect(codes.has(email)).toBe(false);
    await post('request', { email }).expect(429);
  });

  it('surfaces SMS delivery failure without creating or verifying an account', async () => {
    const p = await proof(); const number = phone(); rejectedPhones.add(number);
    await post('request-phone', { continuationToken: p.continuationToken, phone: number, firstName: 'New', lastName: 'Person', privacyAccepted: true }).expect(503);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(0);
  });

  it('rolls back code consumption if session issuance fails', async () => {
    const f = await account({ verified: true }); const c = await challenge(f.email);
    const service = app.get(ClientTokenService);
    const spy = jest.spyOn(service, 'issueTokenPair').mockRejectedValueOnce(new Error('synthetic token failure'));
    await post('verify', { challengeId: c.challengeId, code: c.code }).expect(500);
    spy.mockRestore();
    await post('verify', { challengeId: c.challengeId, code: c.code }).expect(200);
    expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client!.id } })).toBe(1);
  });

  it('refuses an expired email challenge and does not expose account state', async () => {
    const c = await challenge();
    await prisma.$executeRaw`UPDATE "MobileEmailFlow" SET "emailExpiresAt" = now() - interval '1 minute' WHERE id = ${c.challengeId}`;
    const result = await post('verify', { challengeId: c.challengeId, code: c.code }).expect(400);
    expect(result.body).not.toHaveProperty('next');
    expect(result.body).not.toHaveProperty('tokens');
  });

  it('commits failed phone attempts and rejects its valid code after exhaustion', async () => {
    const p = await proof(); const sms = await phoneChallenge(p, phone(), true);
    const wrong = sms.code === '000000' ? '111111' : '000000';
    const results = await Promise.all(Array.from({ length: 5 }, () => finish({ ...sms, code: wrong })));
    expect(results.every(x => x.status === 400)).toBe(true);
    await finish(sms).expect(400);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(0);
  });

  it('blocks expired continuation even while its SMS code is fresh', async () => {
    const p = await proof(); const sms = await phoneChallenge(p, phone(), true);
    await prisma.$executeRaw`UPDATE "MobileEmailFlow" SET "continuationExpiresAt" = now() - interval '1 minute' WHERE email = ${p.email}`;
    await finish(sms).expect(400);
    expect(await prisma.user.count({ where: { email: p.email } })).toBe(0);
  });

  it('caps wrong registered-phone guesses without disclosing the correct number', async () => {
    const f = await account(); const p = await proof(f.email);
    for (let n = 0; n < 5; n++) {
      const response = await post('request-phone', { continuationToken: p.continuationToken, phone: phone() });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(response.body)).not.toContain(f.phone);
    }
    expect((await post('request-phone', { continuationToken: p.continuationToken, phone: f.phone })).status).toBeGreaterThanOrEqual(400);
    expect(codes.has(f.phone)).toBe(false);
  });

  it('refuses stale or swapped phone challenge/continuation combinations', async () => {
    const p1 = await proof(); const p2 = await proof();
    const sms1 = await phoneChallenge(p1, phone(), true); const sms2 = await phoneChallenge(p2, phone(), true);
    await finish({ ...sms1, continuationToken: sms2.continuationToken }).expect(400);
    await finish({ ...sms1, continuationToken: p1.continuationToken }).expect(400);
    await finish(sms1).expect(200);
  });

  it('keeps a verified practitioner in the staff namespace and rejects non-practitioner staff', async () => {
    const employee = await account({ verified: true, role: 'EMPLOYEE' });
    await prisma.employee.create({ data: { userId: employee.user.id, name: 'Synthetic email practitioner' } });
    const response = await proof(employee.email);
    expect(response).toMatchObject({ next: 'authenticated', sessionKind: 'staff' });
    const row = await prisma.refreshToken.findFirstOrThrow({ where: { userId: employee.user.id } });
    expect(row.source).toBe('MOBILE');
    const admin = await account({ verified: true, role: 'ADMIN' });
    expect((await proof(admin.email)).next).toBe('unavailable');
    expect(await prisma.refreshToken.count({ where: { userId: admin.user.id } })).toBe(0);
  });

  it('does not bypass required MFA for a super-admin practitioner', async () => {
    const f = await account({ verified: true, role: 'ADMIN' });
    await prisma.user.update({ where: { id: f.user.id }, data: { isSuperAdmin: true } });
    await prisma.employee.create({ data: { userId: f.user.id, name: 'Synthetic MFA practitioner' } });
    const settings = app.get(PlatformSettingsService);
    const original = settings.get.bind(settings);
    const spy = jest.spyOn(settings, 'get').mockImplementation((key: string) =>
      key === 'security.twoFactor.required' ? Promise.resolve(true) : original(key));
    try {
      expect((await proof(f.email)).next).toBe('unavailable');
      expect(await prisma.refreshToken.count({ where: { userId: f.user.id } })).toBe(0);
    } finally { spy.mockRestore(); }
  });

  it('signs a Client-only account in by its verified email without creating a User', async () => {
    const email = address();
    const c = await prisma.client.create({ data: { name: 'Synthetic client only', email, emailVerified: new Date(), phone: phone() } });
    clients.add(c.id);
    const result = await proof(email);
    expect(result).toMatchObject({ next: 'authenticated', sessionKind: 'client' });
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${result.tokens.accessToken}`).expect(200);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: c.id } })).lastLoginAt).toBeInstanceOf(Date);
  });

  it('refuses a Client-only account whose stored email was never proven', async () => {
    const email = address();
    const c = await prisma.client.create({ data: { name: 'Synthetic legacy client', email, emailVerified: null, phone: phone() } });
    clients.add(c.id);
    expect((await proof(email)).next).toBe('unavailable');
    expect(await prisma.clientRefreshToken.count({ where: { clientId: c.id } })).toBe(0);
  });

  it('never reactivates or adopts a deleted Client', async () => {
    const f = await account({ verified: true });
    await prisma.client.update({ where: { id: f.client!.id }, data: { deletedAt: new Date() } });
    expect((await proof(f.email)).next).toBe('unavailable');
    expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client!.id } })).toBe(0);
  });

  it('enforces canonical email uniqueness while preserving legacy soft-delete contact reuse', async () => {
    const f = await account({ verified: true });
    await expect(prisma.user.create({ data: { email: f.email.toUpperCase(), name: 'Duplicate', role: 'CLIENT' } }))
      .rejects.toMatchObject({ code: 'P2002' });
    await prisma.client.update({ where: { id: f.client!.id }, data: { deletedAt: new Date() } });
    const reused = await prisma.client.create({ data: { email: f.email.toUpperCase(), name: 'Synthetic legacy reuse' } });
    clients.add(reused.id);
    expect(reused.id).not.toBe(f.client!.id);
    // The new flow still refuses ambiguous ownership; the DB preserves old consumers' policy.
    expect((await proof(f.email)).next).toBe('unavailable');
  });

  it('resend rotates phone proof and invalidates the old challenge without extending email ownership', async () => {
    const p = await proof(); const sms = await phoneChallenge(p, phone(), true);
    const before = await prisma.$queryRaw<Array<{ continuationExpiresAt: Date }>>`SELECT "continuationExpiresAt" FROM "MobileEmailFlow" WHERE email = ${p.email}`;
    await post('resend-phone', { phoneChallengeId: sms.phoneChallengeId, continuationToken: sms.continuationToken }).expect(429);
    await expireCooldown('SMS', sms.phone);
    const response = await post('resend-phone', { phoneChallengeId: sms.phoneChallengeId, continuationToken: sms.continuationToken }).expect(200);
    expect(response.body.continuationToken).not.toBe(sms.continuationToken);
    expect(response.body.phoneChallengeId).not.toBe(sms.phoneChallengeId);
    const after = await prisma.$queryRaw<Array<{ continuationExpiresAt: Date }>>`SELECT "continuationExpiresAt" FROM "MobileEmailFlow" WHERE email = ${p.email}`;
    expect(after[0].continuationExpiresAt).toEqual(before[0].continuationExpiresAt);
    await finish(sms).expect(400);
    await finish({ ...response.body, code: codes.get(sms.phone)! }).expect(200);
  });

  it('enforces hourly email limits across newly created challenge ids', async () => {
    const email = address();
    for (let n = 0; n < 5; n++) {
      await challenge(email);
      await expireCooldown('EMAIL', email);
    }
    const sixth = await post('request', { email }).expect(429);
    expect(JSON.stringify(sixth.body)).not.toContain(email);
  });
});
