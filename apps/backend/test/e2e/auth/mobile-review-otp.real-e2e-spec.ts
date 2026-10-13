/** Fixed reviewer OTP through real HTTP, PostgreSQL locks/sessions and Redis cooldown. */
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import type Redis from 'ioredis';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { SINGLE_TENANT_CONTEXT_ID } from '../../../src/common/constants';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { EmailChannelAdapter } from '../../../src/modules/comms/notification-channel/email-channel.adapter';
import { SmsChannelAdapter } from '../../../src/modules/comms/notification-channel/sms-channel.adapter';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
describeReal('Synthetic Apple review OTP — real HTTP and persisted challenges', () => {
  jest.setTimeout(90_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ConfigService;
  let redis: Redis;
  const id = randomUUID();
  const email = 'apple@review.sawaa.invalid';
  const code = '4837'; // Public fixture, never the deployed reviewer code.
  const password = 'ReviewFixtureOnly123!';
  let hash: string;
  let ownsClient = false;
  const userIds: string[] = [];
  const collisionUserIds: string[] = [];
  const otherClientIds: string[] = [];
  const otherEmails: string[] = [];
  const delivered = new Map<string, string>();
  const api = () => request(app.getHttpServer());
  const cooldown = (identifier = email, purpose = 'MOBILE_LOGIN') => `otp:cooldown:${SINGLE_TENANT_CONTEXT_ID}:${identifier}:${purpose}`;
  const issue = (identifier = email) => api().post('/api/v1/mobile/auth/request-login-otp').send({ identifier });
  const verify = (value = code, identifier = email, purpose = 'login') => api().post('/api/v1/mobile/auth/verify-otp').send({ identifier, code: value, purpose });

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    // setup-e2e normally mocks ioredis; only this owned cooldown connection is real.
    const RealRedis = jest.requireActual('ioredis').default;
    redis = new RealRedis({ host: '127.0.0.1', port: Number(process.env.REDIS_PORT ?? 6379), db: Number(process.env.REDIS_DB ?? 0), maxRetriesPerRequest: 1 });
    expect(await redis.ping()).toBe('PONG');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RedisService).useValue({ getClient: () => redis })
      .overrideProvider(EmailChannelAdapter).useValue({ kind: 'EMAIL', send: async (identifier: string, value: string) => { delivered.set(identifier, value); } })
      .overrideProvider(SmsChannelAdapter).useValue({ kind: 'SMS', send: async (identifier: string, value: string) => { delivered.set(identifier, value); } })
      .compile();
    app = module.createNestApplication();
    configureHttpContract(app, 'production');
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService); config = app.get(ConfigService);
    if (await prisma.client.findFirst({ where: { email } })) throw new Error('Refusing to overwrite an existing review fixture');
    hash = await bcrypt.hash(code, 10);
    await prisma.client.create({ data: { id, email, name: 'Synthetic reviewer', accountType: 'FULL', emailVerified: new Date(), passwordHash: await bcrypt.hash(password, 10) } });
    ownsClient = true;
  });

  beforeEach(async () => {
    config.set('MOBILE_REVIEW_CLIENT_ID', id);
    config.set('MOBILE_REVIEW_OTP_HASH', hash);
    config.set('MOBILE_REVIEW_OTP_EXPIRES_AT', new Date(Date.now() + 3_600_000).toISOString());
    await redis.del(cooldown()); delivered.clear();
  });

  afterEach(async () => {
    if (prisma && collisionUserIds.length) {
      await prisma.employee.deleteMany({ where: { userId: { in: collisionUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: collisionUserIds } } });
      collisionUserIds.length = 0;
    }
    if (ownsClient) {
      await prisma.client.update({ where: { id }, data: { isActive: true, deletedAt: null, userId: null, phone: null, emailVerified: new Date() } });
      await prisma.otpCode.deleteMany({ where: { identifier: email } });
      await redis.del(cooldown());
    }
  });
  afterAll(async () => {
    if (prisma) {
      const ids = [...otherClientIds, ...(ownsClient ? [id] : [])];
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: ids } } });
      await prisma.client.deleteMany({ where: { id: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.otpCode.deleteMany({ where: { identifier: { in: otherEmails } } });
      for (const identifier of otherEmails) await redis.del(cooldown(identifier));
    }
    if (app) await app.close();
    if (redis) await redis.quit();
  });

  it('supports password without OTP, fixed OTP login, profile and native refresh', async () => {
    const passwordSession = await api().post('/api/v1/mobile/auth/password-login').send({ email, password }).expect(200);
    expect(passwordSession.body.sessionKind).toBe('client');
    expect(await prisma.otpCode.count({ where: { identifier: email } })).toBe(0);
    await issue(` ${email.toUpperCase()} `).expect(200);
    expect(delivered.has(email)).toBe(false);
    const row = await prisma.otpCode.findFirstOrThrow({ where: { identifier: email } });
    expect(row.codeHash).toBe(hash);
    const result = await verify().expect(200);
    expect(result.body.sessionKind).toBe('client');
    const payload = JSON.parse(Buffer.from(result.body.tokens.accessToken.split('.')[1], 'base64url').toString());
    expect(payload.sub).toBe(id);
    expect(payload.namespace).toBe('client');
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${result.body.tokens.accessToken}`).expect(200);
    await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: result.body.tokens.refreshToken }).expect(200);
    await verify().expect(400);
  });

  it('persists failed attempts and rejects the correct code after lockout', async () => {
    await issue().expect(200);
    for (let attempt = 1; attempt <= 5; attempt++) {
      await verify('0000').expect(401);
      expect((await prisma.otpCode.findFirstOrThrow({ where: { identifier: email } })).attempts).toBe(attempt);
    }
    await verify().expect(400);
  });

  it('permits one session only when two verifications race', async () => {
    const before = await prisma.clientRefreshToken.count({ where: { clientId: id } });
    await issue().expect(200);
    const results = await Promise.all([verify(), verify()]);
    expect(results.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await prisma.clientRefreshToken.count({ where: { clientId: id } })).toBe(before + 1);
  });

  it('retains Redis cooldown and allows the same configured code on a fresh challenge', async () => {
    await issue().expect(200);
    await issue().expect(429);
    await verify().expect(200);
    // Simulate cooldown passage only for this suite-owned key, never flush Redis.
    await redis.del(cooldown());
    await issue().expect(200);
    await verify().expect(200);
  });

  it.each(['MOBILE_REVIEW_OTP_HASH', 'MOBILE_REVIEW_OTP_EXPIRES_AT'])('fails closed with a leftover challenge after disabling %s', async key => {
    await issue().expect(200);
    config.set(key, '');
    await verify().expect(401);
  });

  it('denies expired challenges, retired configuration and registration', async () => {
    await issue().expect(200);
    await verify(code, email, 'register').expect(401);
    await prisma.otpCode.updateMany({ where: { identifier: email }, data: { expiresAt: new Date(Date.now() - 1) } });
    await verify().expect(400);
    config.set('MOBILE_REVIEW_OTP_EXPIRES_AT', '2000-01-01T00:00:00Z');
    await verify().expect(401);
  });

  it('denies a disabled or linked client even with an issued fixed challenge', async () => {
    await issue().expect(200);
    await prisma.client.update({ where: { id }, data: { isActive: false } });
    await verify().expect(401);
    const user = await prisma.user.create({ data: { email: `review-link-${id}@example.test`, name: 'Synthetic link', role: 'CLIENT' } });
    userIds.push(user.id);
    await prisma.client.update({ where: { id }, data: { isActive: true, userId: user.id } });
    await verify().expect(401);
  });


  it.each([false, true])('never gives a later staff identity the issued fixed code (config removed=%s)', async disable => {
    await issue().expect(200);
    const staff = await prisma.user.create({ data: { email, name: 'Synthetic collision', role: 'EMPLOYEE', emailVerifiedAt: new Date() } });
    collisionUserIds.push(staff.id);
    await prisma.employee.create({ data: { userId: staff.id, name: staff.name, isActive: true } });
    if (disable) config.set('MOBILE_REVIEW_OTP_HASH', '');
    await verify().expect(401);
    expect(await prisma.refreshToken.count({ where: { userId: staff.id } })).toBe(0);
  });

  it('cannot consume the review challenge or mutate email ownership through generic public verification', async () => {
    await issue().expect(200);
    config.set('MOBILE_REVIEW_OTP_HASH', '');
    await prisma.client.update({ where: { id }, data: { emailVerified: null } });
    await api().post('/api/v1/public/otp/verify').send({ identifier: email, channel: 'EMAIL', purpose: 'MOBILE_LOGIN', code }).expect(400);
    expect((await prisma.client.findUniqueOrThrow({ where: { id } })).emailVerified).toBeNull();
    expect((await prisma.otpCode.findFirstOrThrow({ where: { identifier: email } })).consumedAt).toBeNull();
  });

  it('preserves real-customer random OTP and never substitutes the reviewer hash', async () => {
    const otherEmail = `review-normal-${id}@example.test`; otherEmails.push(otherEmail);
    const user = await prisma.user.create({ data: { email: otherEmail, name: 'Synthetic ordinary client', role: 'CLIENT', emailVerifiedAt: new Date() } });
    userIds.push(user.id);
    const other = await prisma.client.create({ data: { email: otherEmail, name: user.name, userId: user.id, accountType: 'FULL', emailVerified: new Date() } });
    otherClientIds.push(other.id);
    await issue(otherEmail).expect(200);
    const row = await prisma.otpCode.findFirstOrThrow({ where: { identifier: otherEmail } });
    expect(row.codeHash).not.toBe(hash);
    expect(delivered.get(otherEmail)).toMatch(/^\d{4}$/);
    const wrong = delivered.get(otherEmail) === code ? '9362' : code;
    await verify(wrong, otherEmail).expect(401);
    await verify(delivered.get(otherEmail)!, otherEmail).expect(200);
  });
});
