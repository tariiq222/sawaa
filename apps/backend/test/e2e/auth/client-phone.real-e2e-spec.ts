/** Real PostgreSQL + Redis; SMS delivery is captured in memory. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomInt } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { AuthenticaClient } from '../../../src/infrastructure/authentica';
import { SmsChannelAdapter } from '../../../src/modules/comms/notification-channel/sms-channel.adapter';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
const root = '/api/v1/mobile/client/profile/phone';
const entry = '/api/v1/mobile/auth/phone-entry';

describeReal('Mobile client phone change — code to the new number', () => {
  jest.setTimeout(90_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let clientTokens: ClientTokenService;
  const codes = new Map<string, string>();
  const phones = new Set<string>();
  const clients = new Set<string>();
  const number = () => { const value = `+9665${randomInt(10_000_000, 100_000_000)}`; phones.add(value); return value; };
  const api = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    const ActualRedis = jest.requireActual<typeof import('ioredis')>('ioredis').default;
    redis = new ActualRedis({ host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT ?? 6379), db: Number(process.env.REDIS_DB ?? 13), password: process.env.REDIS_PASSWORD || undefined });
    await redis.ping();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue({ getClient: () => redis })
      .overrideProvider(AuthenticaClient).useValue({ isConfigured: () => true })
      .overrideProvider(SmsChannelAdapter).useValue({ kind: 'SMS', send: async (phone: string, code: string) => { codes.set(phone, code); } })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureHttpContract(app, 'production');
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    clientTokens = app.get(ClientTokenService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.clientPhoneChallenge.deleteMany({ where: { clientId: { in: [...clients] } } });
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: [...clients] } } });
      const created = await prisma.client.findMany({ where: { phone: { in: [...phones] } }, select: { id: true } });
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: created.map(c => c.id) } } });
      await prisma.client.deleteMany({ where: { OR: [{ id: { in: [...clients] } }, { phone: { in: [...phones] } }] } });
      await prisma.mobilePhoneEntryFlow.deleteMany({ where: { phone: { in: [...phones] } } });
    }
    if (app) await app.close();
    if (redis) {
      for (const key of [...phones, ...[...clients].map(id => `client-phone:${id}`)]) {
        const hash = createHash('sha256').update(`SMS:${key}`).digest('hex');
        await redis.del(`mobile-email-send:{${hash}}`, `mobile-email-send:{${hash}}:cooldown`);
      }
      await redis.quit();
    }
  });

  async function signedInClient() {
    const phone = number();
    const client = await prisma.client.create({ data: { name: 'Synthetic phone change', phone, phoneVerified: new Date(), accountType: 'FULL' } });
    clients.add(client.id);
    const pair = await clientTokens.issueTokenPair(client);
    return { client, phone, accessToken: pair.accessToken, refreshToken: pair.rawRefresh };
  }
  async function phoneEntry(phone: string) {
    // Test-clock boundary: one 60s cooldown per number is shared across flows.
    const hash = createHash('sha256').update(`SMS:${phone}`).digest('hex');
    await redis.pexpire(`mobile-email-send:{${hash}}:cooldown`, 0);
    const requested = await api().post(`${entry}/request`).send({ phone }).expect(200);
    return api().post(`${entry}/verify`).send({ challengeId: requested.body.challengeId, code: codes.get(phone) }).expect(200);
  }

  it('changes the number with a code to the new number and closes every other session', async () => {
    const f = await signedInClient();
    const next = number();
    const requested = await api().post(`${root}/request`).set(auth(f.accessToken)).send({ phone: `0${next.slice(4)}` }).expect(200);
    expect(requested.headers['cache-control']).toContain('no-store');
    expect(codes.get(next)).toMatch(/^\d{6}$/);
    // Nothing changes before the code is proven.
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).phone).toBe(f.phone);

    const verified = await api().post(`${root}/verify`).set(auth(f.accessToken)).send({ challengeId: requested.body.challengeId, code: codes.get(next) }).expect(200);
    expect(verified.body).toEqual({ phone: next, tokens: { accessToken: expect.any(String), refreshToken: expect.any(String) } });
    const row = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(row).toMatchObject({ phone: next, phoneVerified: expect.any(Date), tokenVersion: f.client.tokenVersion + 1 });

    // Old session is dead; the new one works.
    await api().get('/api/v1/mobile/client/profile').set(auth(f.accessToken)).expect(401);
    await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: f.refreshToken }).expect(401);
    await api().get('/api/v1/mobile/client/profile').set(auth(verified.body.tokens.accessToken)).expect(200);

    // The new number signs into the same account; the old one no longer does.
    const viaNew = await phoneEntry(next);
    expect(viaNew.body).toMatchObject({ next: 'authenticated' });
    const claim = JSON.parse(Buffer.from(viaNew.body.tokens.accessToken.split('.')[1], 'base64url').toString()) as { sub: string };
    expect(claim.sub).toBe(f.client.id);
    expect((await phoneEntry(f.phone)).body).toMatchObject({ next: 'register' });
  });

  it('refuses a direct phone edit through the profile form', async () => {
    const f = await signedInClient();
    const res = await api().patch('/api/v1/mobile/client/profile').set(auth(f.accessToken)).send({ phone: number() }).expect(400);
    expect(res.body.code ?? res.body.message).toBe('phone_change_requires_verification');
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).phone).toBe(f.phone);
  });

  it('decides ownership only at verify and never reveals the holder', async () => {
    const holder = await signedInClient();
    const f = await signedInClient();
    const requested = await api().post(`${root}/request`).set(auth(f.accessToken)).send({ phone: holder.phone }).expect(200);
    const res = await api().post(`${root}/verify`).set(auth(f.accessToken)).send({ challengeId: requested.body.challengeId, code: codes.get(holder.phone) }).expect(409);
    expect(res.body).toMatchObject({ code: 'details_unavailable' });
    expect(JSON.stringify(res.body)).not.toContain(holder.phone.slice(-6));
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).phone).toBe(f.phone);
  });

  it('rejects the current number, foreign numbers and other clients\u2019 challenges', async () => {
    const a = await signedInClient();
    const b = await signedInClient();
    expect((await api().post(`${root}/request`).set(auth(a.accessToken)).send({ phone: a.phone }).expect(400)).body.code).toBe('phone_unchanged');
    expect((await api().post(`${root}/request`).set(auth(a.accessToken)).send({ phone: '+14155550100' }).expect(400)).body.code).toBe('invalid_phone');
    const target = number();
    const requested = await api().post(`${root}/request`).set(auth(b.accessToken)).send({ phone: target }).expect(200);
    await api().post(`${root}/verify`).set(auth(a.accessToken)).send({ challengeId: requested.body.challengeId, code: codes.get(target) }).expect(400);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: a.client.id } })).phone).toBe(a.phone);
  });

  it('blocks unauthenticated access', async () => {
    await api().post(`${root}/request`).send({ phone: number() }).expect(401);
  });
});
