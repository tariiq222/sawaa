/** Real PostgreSQL + Redis; all SMS/email delivery is captured in memory. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { AuthenticaClient } from '../../../src/infrastructure/authentica';
import { EmailChannelAdapter } from '../../../src/modules/comms/notification-channel/email-channel.adapter';
import { SmsChannelAdapter } from '../../../src/modules/comms/notification-channel/sms-channel.adapter';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';
import { PRIVACY_POLICY_VERSION } from '../../../src/modules/identity/client-auth/consent.constants';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
const root = '/api/v1/mobile/auth/phone-entry';

describeReal('Mobile phone entry — real proof and identity boundaries', () => {
  jest.setTimeout(90_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  const prefix = `phone-entry-${randomUUID()}`;
  const codes = new Map<string, string>();
  const phones = new Set<string>();
  const clients = new Set<string>();
  const users = new Set<string>();
  const rejectedPhones = new Set<string>();
  const number = () => { const value = `+9665${randomInt(10_000_000, 100_000_000)}`; phones.add(value); return value; };
  const api = () => request(app.getHttpServer());
  const post = (path: string, body: object) => api().post(`${root}/${path}`).send(body);

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    const ActualRedis = jest.requireActual<typeof import('ioredis')>('ioredis').default;
    redis = new ActualRedis({ host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT ?? 6379), db: Number(process.env.REDIS_DB ?? 13), password: process.env.REDIS_PASSWORD || undefined });
    await redis.ping();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue({ getClient: () => redis })
      .overrideProvider(AuthenticaClient).useValue({ isConfigured: () => true })
      .overrideProvider(EmailChannelAdapter).useValue({ kind: 'EMAIL', send: async (email: string, code: string) => { codes.set(email, code); } })
      .overrideProvider(SmsChannelAdapter).useValue({ kind: 'SMS', send: async (phone: string, code: string) => {
        if (rejectedPhones.has(phone)) throw new Error('synthetic private provider error');
        codes.set(phone, code);
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
      const owned = await prisma.client.findMany({ where: { phone: { in: [...phones] } }, select: { id: true } });
      owned.forEach(client => clients.add(client.id));
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: [...clients] } } });
      await prisma.client.deleteMany({ where: { id: { in: [...clients] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: [...users] } } });
      await prisma.employee.deleteMany({ where: { userId: { in: [...users] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...users] } } });
      await prisma.mobilePhoneEntryFlow.deleteMany({ where: { phone: { in: [...phones] } } });
    }
    if (app) await app.close();
    if (redis) {
      for (const phone of phones) {
        const hash = createHash('sha256').update(`SMS:${phone}`).digest('hex');
        await redis.del(`mobile-email-send:{${hash}}`, `mobile-email-send:{${hash}}:cooldown`);
      }
      await redis.quit();
    }
  });

  async function challenge(phone = number()) {
    const response = await post('request', { phone }).expect(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toEqual({ challengeId: expect.any(String), maskedPhone: expect.any(String), expiresIn: 300, retryAfterSeconds: 60 });
    expect(codes.get(phone)).toMatch(/^\d{6}$/);
    return { phone, challengeId: response.body.challengeId as string, code: codes.get(phone)! };
  }
  async function proof(phone = number()) {
    const c = await challenge(phone);
    const response = await post('verify', { challengeId: c.challengeId, code: c.code }).expect(200);
    return { ...c, continuationToken: response.body.continuationToken as string, next: response.body.next as string };
  }
  const details = (continuationToken: string) => ({ continuationToken, firstName: ' Synthetic ', lastName: ' Entry ', email: ` ${prefix}@EXAMPLE.TEST `, privacyAccepted: true });
  async function expireCooldown(phone: string) {
    const hash = createHash('sha256').update(`SMS:${phone}`).digest('hex');
    await redis.pexpire(`mobile-email-send:{${hash}}:cooldown`, 0);
  }

  it('registers a client only after completion and issues a usable client session', async () => {
    const p = await proof();
    expect(p.next).toBe('register');
    expect(await prisma.client.count({ where: { phone: p.phone } })).toBe(0);
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${p.continuationToken}`).expect(401);
    const result = await post('complete', details(p.continuationToken)).expect(200);
    expect(result.body).toMatchObject({ next: 'authenticated', sessionKind: 'client', emailPrompt: false, tokens: { accessToken: expect.any(String), refreshToken: expect.any(String) } });
    const client = await prisma.client.findFirstOrThrow({ where: { phone: p.phone } });
    expect(client).toMatchObject({ userId: null, firstName: 'Synthetic', lastName: 'Entry', name: 'Synthetic Entry', email: null, pendingEmail: `${prefix}@example.test`, accountType: 'FULL', source: 'ONLINE', consentVersion: PRIVACY_POLICY_VERSION });
    expect(client.phoneVerified).not.toBeNull(); expect(client.claimedAt).not.toBeNull(); expect(client.consentedAt).not.toBeNull(); expect(client.lastLoginAt).not.toBeNull();
    expect(await prisma.user.count({ where: { phone: p.phone } })).toBe(0);
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${result.body.tokens.accessToken}`).expect(200);
    await post('complete', details(p.continuationToken)).expect(400);
  });

  it('uses the same phone challenge for staff and keeps token namespaces isolated', async () => {
    const phone = number();
    const user = await prisma.user.create({ data: { email: `${prefix}-staff@example.test`, name: 'Synthetic Staff', phone, role: 'EMPLOYEE', isActive: true } });
    users.add(user.id);
    await prisma.employee.create({ data: { userId: user.id, name: 'Synthetic Staff', isActive: true } });
    const c = await challenge(phone);
    const result = await post('verify', { challengeId: c.challengeId, code: c.code }).expect(200);
    expect(result.body).toMatchObject({ next: 'authenticated', sessionKind: 'staff', emailPrompt: false });
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${result.body.tokens.accessToken}`).expect(401);
    expect(await prisma.refreshToken.count({ where: { userId: user.id, source: 'MOBILE' } })).toBe(1);
    await post('verify', { challengeId: c.challengeId, code: c.code }).expect(400);
  });

  it('consumes one continuation exactly once under concurrent completions', async () => {
    const p = await proof();
    const results = await Promise.all([post('complete', details(p.continuationToken)), post('complete', details(p.continuationToken))]);
    expect(results.map(result => result.status).sort()).toEqual([200, 400]);
    expect(await prisma.client.count({ where: { phone: p.phone } })).toBe(1);
    const client = await prisma.client.findFirstOrThrow({ where: { phone: p.phone } });
    expect(await prisma.clientRefreshToken.count({ where: { clientId: client.id } })).toBe(1);
  });

  it('opens a legacy WALK_IN record without changing claim semantics and prompts for unverified email', async () => {
    const phone = number();
    const client = await prisma.client.create({ data: { name: 'Synthetic Legacy', phone, email: `${prefix}-legacy@example.test`, accountType: 'WALK_IN' } });
    clients.add(client.id);
    const c = await challenge(phone);
    const result = await post('verify', { challengeId: c.challengeId, code: c.code }).expect(200);
    expect(result.body).toMatchObject({ next: 'authenticated', sessionKind: 'client', emailPrompt: true });
    const updated = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(updated.phoneVerified).not.toBeNull(); expect(updated.lastLoginAt).not.toBeNull();
    expect(updated.accountType).toBe('WALK_IN'); expect(updated.claimedAt).toBeNull();
  });

  it('returns byte-identical request shape/status for known and unknown numbers', async () => {
    const phone = number();
    const client = await prisma.client.create({ data: { name: 'Synthetic Known', phone } }); clients.add(client.id);
    const known = await post('request', { phone }).expect(200);
    const unknown = await post('request', { phone: number() }).expect(200);
    const shape = (body: Record<string, unknown>) => JSON.stringify(Object.entries(body).map(([key, value]) => [key, typeof value]));
    expect(shape(known.body)).toBe(shape(unknown.body));
    expect(known.body.expiresIn).toBe(unknown.body.expiresIn); expect(known.body.retryAfterSeconds).toBe(unknown.body.retryAfterSeconds);
  });

  it('enforces the hourly SMS limit across distinct challenges', async () => {
    const phone = number();
    for (let i = 0; i < 5; i++) { await challenge(phone); await expireCooldown(phone); }
    const response = await post('request', { phone }).expect(429);
    expect(response.body).toMatchObject({ code: 'send_limited', retryAfterSeconds: expect.any(Number) });
  });

  it('commits five incorrect attempts before rejecting a correct code', async () => {
    const c = await challenge(); const wrong = c.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) await post('verify', { challengeId: c.challengeId, code: wrong }).expect(400);
    expect((await prisma.mobilePhoneEntryFlow.findUniqueOrThrow({ where: { id: c.challengeId } })).attempts).toBe(5);
    await post('verify', { challengeId: c.challengeId, code: c.code }).expect(400);
  });

  it('rechecks phone ownership at completion and rejects a racing account', async () => {
    const p = await proof();
    const client = await prisma.client.create({ data: { name: 'Synthetic Race', phone: p.phone } }); clients.add(client.id);
    const result = await post('complete', details(p.continuationToken)).expect(409);
    expect(result.body.code).toBe('details_unavailable');
    expect(await prisma.client.count({ where: { phone: p.phone } })).toBe(1);
  });

  it('never exposes raw delivery errors for unknown or known numbers', async () => {
    const known = number(); const unknown = number();
    const client = await prisma.client.create({ data: { name: 'Synthetic Delivery', phone: known } }); clients.add(client.id);
    for (const phone of [known, unknown]) {
      rejectedPhones.add(phone);
      const result = await post('request', { phone }).expect(503);
      expect(result.body.code).toBe('delivery_unavailable'); expect(JSON.stringify(result.body)).not.toContain('private provider');
    }
  });
});
