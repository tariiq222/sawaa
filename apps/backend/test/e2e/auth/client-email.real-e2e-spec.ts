/**
 * Real PostgreSQL + Redis client-email verification tests; emails leave only in-memory captures.
 * Runs only against a disposable migrated test DB (REAL_E2E_DATABASE_URL).
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import type Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { EmailChannelAdapter } from '../../../src/modules/comms/notification-channel/email-channel.adapter';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
const root = '/api/v1/mobile/client/profile/email';

describeReal('Mobile client email — real verification boundaries', () => {
  jest.setTimeout(90_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: Redis;
  let clientTokens: ClientTokenService;
  const prefix = `client-email-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const codes = new Map<string, string>();
  const clients = new Set<string>();
  const users = new Set<string>();
  const address = () => `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
  const phone = () => `+96656${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    // E2E global setup mocks Redis; this suite deliberately exercises the real Lua send limiter.
    const ActualRedis = jest.requireActual<typeof import('ioredis')>('ioredis').default;
    redis = new ActualRedis({
      host: process.env.REDIS_HOST ?? '127.0.0.1', port: Number(process.env.REDIS_PORT ?? 6379),
      db: Number(process.env.REDIS_DB ?? 13), password: process.env.REDIS_PASSWORD || undefined,
    });
    await redis.ping();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue({ getClient: () => redis })
      .overrideProvider(EmailChannelAdapter).useValue({ kind: 'EMAIL', send: async (email: string, code: string) => {
        codes.set(email, code);
      } })
      .compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    configureHttpContract(app, 'production');
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    clientTokens = app.get(ClientTokenService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (prisma) {
      // Only this run's synthetic data; do not flush Redis or clear unrelated database rows.
      await prisma.clientEmailChallenge.deleteMany({ where: { clientId: { in: [...clients] } } }).catch(() => undefined);
      await prisma.mobileEmailFlow.deleteMany({ where: { email: { startsWith: prefix } } });
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: [...clients] } } });
      await prisma.client.deleteMany({ where: { id: { in: [...clients] } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: [...users] } } });
      await prisma.user.deleteMany({ where: { id: { in: [...users] } } });
    }
    if (app) await app.close();
    if (redis) await redis.quit();
  });

  async function account(opts: { email?: string | null; emailVerified?: boolean } = {}) {
    const email = opts.email === undefined ? address() : opts.email;
    const number = phone();
    const user = await prisma.user.create({ data: {
      email: `u-${address()}`, phone: number, name: 'Synthetic client email user', firstName: 'Synthetic', lastName: 'Email',
      role: 'CLIENT', isActive: true, emailVerifiedAt: opts.emailVerified ? new Date() : null,
    } });
    users.add(user.id);
    const client = await prisma.client.create({ data: {
      userId: user.id, name: 'Synthetic client email', phone: number, phoneVerified: new Date(),
      email, emailVerified: opts.emailVerified ? new Date() : null, accountType: 'FULL',
    } });
    clients.add(client.id);
    return { client, user, email, phone: number };
  }
  const bearer = async (client: { id: string; email: string | null; emailVerified?: Date | null; tokenVersion?: number }) => (await clientTokens.issueTokenPair({ ...client, emailVerified: client.emailVerified ?? null })).accessToken;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  // Test-clock boundary: expire only this synthetic client's send cooldown,
  // retaining the real Redis hourly budget and every other key's limits.
  async function expireClientCooldown(clientId: string) {
    const key = createHash('sha256').update(`EMAIL:client-email:${clientId}`).digest('hex');
    await redis.pexpire(`mobile-email-send:{${key}}:cooldown`, 0);
  }

  async function challenge(token: string, email = address()) {
    const result = await api().post(`${root}/request`).set(auth(token)).send({ email }).expect(200);
    expect(result.headers['cache-control']).toContain('no-store');
    expect(result.body).toMatchObject({ maskedEmail: `${email[0]}***@${email.split('@')[1]}`, expiresIn: 300, retryAfterSeconds: 60 });
    expect(codes.get(email)).toMatch(/^\d{6}$/);
    return { ...result.body, email, code: codes.get(email)! };
  }

  it('request→verify promotes a pending email over a legacy unverified one', async () => {
    const legacy = address();
    const f = await account({ email: legacy });
    const token = await bearer(f.client);
    const before = await api().get(root).set(auth(token)).expect(200);
    // The legacy unverified value is never returned; the client is prompted instead.
    expect(before.body).toEqual({ status: 'unverified', email: null, pendingEmail: null, prompt: true });
    expect(JSON.stringify(before.body)).not.toContain(legacy);

    const c = await challenge(token);
    const pending = await api().get(root).set(auth(token)).expect(200);
    expect(pending.body).toEqual({ status: 'pending', email: null, pendingEmail: c.email, prompt: true });
    // The pending value never occupies the address: a second client can hold it meanwhile.
    expect(await prisma.client.count({ where: { pendingEmail: c.email } })).toBe(1);

    const verified = await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(200);
    expect(verified.body).toEqual({ status: 'verified', email: c.email, pendingEmail: null, prompt: false });
    const row = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(row.email).toBe(c.email);
    expect(row.emailVerified).not.toBeNull();
    expect(row.pendingEmail).toBeNull();
    expect(row.emailPromptResolvedAt).not.toBeNull();
    // One-time use.
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(400);
  });

  it('releases another client unverified copy of the verified address', async () => {
    const target = address();
    const holder = await account({ email: target });
    const f = await account({ email: address() });
    const token = await bearer(f.client);
    const c = await challenge(token, target);
    const verified = await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(200);
    expect(verified.body.status).toBe('verified');
    const released = await prisma.client.findUniqueOrThrow({ where: { id: holder.client.id } });
    expect(released.email).toBeNull();
    expect(released.emailVerified).toBeNull();
    expect(released.isActive).toBe(true);
  });

  it('refuses to steal an address already verified for another client', async () => {
    const target = address();
    const holder = await account({ email: target, emailVerified: true });
    const f = await account({ email: address() });
    const token = await bearer(f.client);
    const c = await challenge(token, target);
    const result = await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(409);
    expect(result.body).toMatchObject({ code: 'details_unavailable' });
    const owner = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(owner.email).not.toBe(target);
    expect(owner.emailVerified).toBeNull();
    expect(await prisma.client.findUniqueOrThrow({ where: { id: holder.client.id } })).toMatchObject({ email: target });
  });

  it('refuses an address held by a User login identity', async () => {
    const target = address();
    const intruder = await account({ email: `intruder-${address()}`, emailVerified: true });
    await prisma.user.update({ where: { id: intruder.user!.id }, data: { email: target } });
    const f = await account({ email: address() });
    const token = await bearer(f.client);
    const c = await challenge(token, target);
    const result = await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(409);
    expect(result.body).toMatchObject({ code: 'details_unavailable' });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).email).not.toBe(target);
  });

  it('decline clears the legacy unverified email, resolves the prompt and voids open challenges', async () => {
    const legacy = address();
    const f = await account({ email: legacy });
    const token = await bearer(f.client);
    const c = await challenge(token);
    const declined = await api().post(`${root}/decline`).set(auth(token)).expect(200);
    expect(declined.body).toEqual({ status: 'none', email: null, pendingEmail: null, prompt: false });
    const row = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(row.email).toBeNull();
    expect(row.pendingEmail).toBeNull();
    expect(row.emailPromptResolvedAt).not.toBeNull();
    expect((await prisma.clientEmailChallenge.findUniqueOrThrow({ where: { id: c.challengeId } })).consumedAt).not.toBeNull();
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(400);
    const after = await api().get(root).set(auth(token)).expect(200);
    expect(after.body).toEqual({ status: 'none', email: null, pendingEmail: null, prompt: false });
  });

  it('decline refuses a verified email', async () => {
    const f = await account({ email: address(), emailVerified: true });
    const token = await bearer(f.client);
    const result = await api().post(`${root}/decline`).set(auth(token)).expect(409);
    expect(result.body).toMatchObject({ code: 'email_verified' });
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).email).not.toBeNull();
  });

  it('a client cannot verify another client challenge', async () => {
    const f = await account({ email: address() });
    const other = await account({ email: null });
    const otherToken = await bearer(other.client);
    const token = await bearer(f.client);
    const c = await challenge(otherToken);
    const result = await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(400);
    expect(result.body).toMatchObject({ code: 'invalid_or_expired_code' });
    // The theft attempt neither consumed the challenge nor changed either client.
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).email).not.toBe(c.email);
    expect((await prisma.clientEmailChallenge.findUniqueOrThrow({ where: { id: c.challengeId } })).consumedAt).toBeNull();
    // The rightful owner can still finish their own verification.
    const verified = await api().post(`${root}/verify`).set(auth(otherToken)).send({ challengeId: c.challengeId, code: c.code }).expect(200);
    expect(verified.body.status).toBe('verified');
  });

  it('request rejects an unchanged verified email and an invalid address', async () => {
    const target = address();
    const f = await account({ email: target, emailVerified: true });
    const token = await bearer(f.client);
    const unchanged = await api().post(`${root}/request`).set(auth(token)).send({ email: target.toUpperCase() }).expect(400);
    expect(unchanged.body).toMatchObject({ code: 'email_unchanged' });
    const invalid = await api().post(`${root}/request`).set(auth(token)).send({ email: 'not-an-email' }).expect(400);
    expect(invalid.body).toMatchObject({ code: 'invalid_email' });
    expect(await prisma.clientEmailChallenge.count({ where: { clientId: f.client.id } })).toBe(0);
  });

  it('a second request supersedes the first challenge and the first code is dead', async () => {
    const f = await account({ email: null });
    const token = await bearer(f.client);
    const first = await challenge(token);
    await expireClientCooldown(f.client.id);
    const second = await challenge(token);
    expect(second.challengeId).not.toBe(first.challengeId);
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: first.challengeId, code: first.code }).expect(400);
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: second.challengeId, code: second.code }).expect(200);
  });

  it('enforces the per-client 60s send cooldown', async () => {
    const f = await account({ email: null });
    const token = await bearer(f.client);
    await challenge(token);
    const result = await api().post(`${root}/request`).set(auth(token)).send({ email: address() }).expect(429);
    expect(result.body).toMatchObject({ code: 'send_limited' });
    expect(typeof result.body.retryAfterSeconds).toBe('number');
  });

  it('commits wrong attempts and caps the challenge at five before rejecting the correct code', async () => {
    const f = await account({ email: null });
    const token = await bearer(f.client);
    const c = await challenge(token);
    const wrong = c.code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: wrong }).expect(400);
    }
    expect((await prisma.clientEmailChallenge.findUniqueOrThrow({ where: { id: c.challengeId } })).attempts).toBe(5);
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(400);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } })).email).toBeNull();
  });

  it('updates the linked CLIENT user email and verification timestamp on promotion', async () => {
    const f = await account({ email: null });
    const token = await bearer(f.client);
    const c = await challenge(token);
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: f.user!.id } });
    expect(user.email).toBe(c.email);
    expect(user.emailVerifiedAt).not.toBeNull();
  });

  it('lets a phone-registered (Client-only) account sign in by email only after proving it', async () => {
    const legacy = address();
    const c0 = await prisma.client.create({ data: {
      name: 'Synthetic phone-first client', phone: phone(), phoneVerified: new Date(), accountType: 'FULL', email: legacy,
    } });
    clients.add(c0.id);
    const token = await bearer(c0);
    // Neither the token claim nor the profile echoes the unproven legacy address.
    const claim = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { email: string };
    expect(claim.email).toBe('');
    const profile = await api().get('/api/v1/mobile/client/profile').set(auth(token)).expect(200);
    expect(profile.body.email).toBeNull();
    // An unproven legacy address cannot be used to sign in.
    const entry = '/api/v1/mobile/auth/email-entry';
    const early = await api().post(`${entry}/request`).send({ email: legacy }).expect(200);
    const earlyVerify = await api().post(`${entry}/verify`).send({ challengeId: early.body.challengeId, code: codes.get(legacy) }).expect(200);
    expect(earlyVerify.body).toEqual({ next: 'unavailable' });

    const c = await challenge(token);
    await api().post(`${root}/verify`).set(auth(token)).send({ challengeId: c.challengeId, code: c.code }).expect(200);
    // Test-clock boundary: the address shares one 60s send cooldown across flows.
    const addressKey = createHash('sha256').update(`EMAIL:${c.email}`).digest('hex');
    await redis.pexpire(`mobile-email-send:{${addressKey}}:cooldown`, 0);
    const proven = await api().post(`${entry}/request`).send({ email: c.email }).expect(200);
    const signedIn = await api().post(`${entry}/verify`).send({ challengeId: proven.body.challengeId, code: codes.get(c.email) }).expect(200);
    expect(signedIn.body).toMatchObject({ next: 'authenticated', sessionKind: 'client' });
    const signedInClaim = JSON.parse(Buffer.from(signedIn.body.tokens.accessToken.split('.')[1], 'base64url').toString()) as { sub: string; email: string };
    expect(signedInClaim).toMatchObject({ sub: c0.id, email: c.email });
    expect(await prisma.user.count({ where: { email: c.email } })).toBe(0);
  });

  it('blocks unauthenticated access to every endpoint', async () => {
    await api().get(root).expect(401);
    await api().post(`${root}/request`).send({ email: address() }).expect(401);
    await api().post(`${root}/verify`).send({ challengeId: randomUUID(), code: '012345' }).expect(401);
    await api().post(`${root}/decline`).expect(401);
  });
});
