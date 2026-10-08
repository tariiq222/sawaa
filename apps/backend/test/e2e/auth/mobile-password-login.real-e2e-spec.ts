/** Customer password login against disposable PostgreSQL; delivery adapters never send messages. */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { PasswordService } from '../../../src/modules/identity/shared/password.service';
import { EmailChannelAdapter } from '../../../src/modules/comms/notification-channel/email-channel.adapter';
import { SmsChannelAdapter } from '../../../src/modules/comms/notification-channel/sms-channel.adapter';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { getRealE2eDatabaseUrl } from '../../helpers/create-real-e2e-app';

const describeReal = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;
describeReal('Mobile customer password login — HTTP and persisted sessions', () => {
  jest.setTimeout(60_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let passwords: PasswordService;
  const prefix = `mobile-password-${randomUUID()}`;
  const clientIds: string[] = [];
  const userIds: string[] = [];
  const identifiers: string[] = [];
  const capturedCodes = new Map<string, string>();
  const password = 'FixtureOnlyPassword123!';
  const post = (body: object) => request(app.getHttpServer()).post('/api/v1/mobile/auth/password-login').send(body);

  beforeAll(async () => {
    process.env.DATABASE_URL = getRealE2eDatabaseUrl();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailChannelAdapter).useValue({ kind: 'EMAIL', send: async (identifier: string, code: string) => capturedCodes.set(identifier, code) })
      .overrideProvider(SmsChannelAdapter).useValue({ kind: 'SMS', send: async (identifier: string, code: string) => capturedCodes.set(identifier, code) })
      .compile();
    app = module.createNestApplication();
    configureHttpContract(app, 'production');
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    passwords = app.get(PasswordService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.passwordHistory.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: clientIds } } });
      await prisma.client.deleteMany({ where: { id: { in: clientIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.otpCode.deleteMany({ where: { identifier: { in: identifiers } } });
    }
    if (app) await app.close();
  });

  async function account(options: { noPassword?: boolean; legacyEmail?: boolean; active?: boolean; linkedInactive?: boolean; unverifiedPhone?: boolean } = {}) {
    const email = `${prefix}-${randomUUID().slice(0, 8)}@example.test`;
    const phone = `+96655${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    identifiers.push(email, phone);
    const user = await prisma.user.create({ data: {
      name: 'Password fixture', email, phone, role: 'CLIENT', isActive: !options.linkedInactive,
      emailVerifiedAt: new Date(), phoneVerifiedAt: options.unverifiedPhone ? null : new Date(),
    } });
    userIds.push(user.id);
    const client = await prisma.client.create({ data: {
      userId: user.id, name: user.name, email: options.legacyEmail ? null : email, phone,
      emailVerified: options.legacyEmail ? null : new Date(), phoneVerified: options.unverifiedPhone ? null : new Date(),
      accountType: 'FULL', isActive: options.active ?? true,
      passwordHash: options.noPassword ? null : await passwords.hash(password),
    } });
    clientIds.push(client.id);
    return { user, client, email, phone };
  }

  it('logs in by normalized email, accesses customer profile and rotates a native session', async () => {
    const f = await account();
    const res = await post({ email: ` ${f.email.toUpperCase()} `, password }).expect(200);
    expect(res.body.sessionKind).toBe('client');
    expect(res.body.tokens).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect(res.headers['set-cookie']).toBeUndefined();
    await request(app.getHttpServer()).get('/api/v1/mobile/client/profile')
      .set('Authorization', `Bearer ${res.body.tokens.accessToken}`).expect(200);
    await request(app.getHttpServer()).post('/api/v1/mobile/auth/refresh')
      .send({ refreshToken: res.body.tokens.refreshToken }).expect(200);
    expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client.id, revokedAt: null } })).toBe(1);
  });

  it('logs in by a local Saudi phone number without requesting another OTP', async () => {
    const f = await account();
    await post({ phone: `0${f.phone.slice(4)}`, password }).expect(200);
    expect(await prisma.otpCode.count({ where: { identifier: f.phone } })).toBe(0);
  });

  it('creates a password via phone proof for a legacy passwordless account and accepts its linked email', async () => {
    const f = await account({ noPassword: true, legacyEmail: true, unverifiedPhone: true });
    const api = () => request(app.getHttpServer());
    await post({ email: f.email, password }).expect(401);
    const proof = { channel: 'SMS', identifier: f.phone, purpose: 'CLIENT_PASSWORD_RESET' };
    await api().post('/api/v1/public/otp/request').send(proof).expect(200);
    const verified = await api().post('/api/v1/public/otp/verify')
      .send({ ...proof, code: capturedCodes.get(f.phone) }).expect(200);
    await api().post('/api/v1/public/auth/reset-password')
      .send({ sessionToken: verified.body.sessionToken, newPassword: password }).expect(204);
    const saved = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(saved.phoneVerified).not.toBeNull();
    expect(saved.emailVerified).toBeNull();
    expect(saved.passwordHash).not.toBe(password);
    expect(await passwords.verify(password, saved.passwordHash!)).toBe(true);
    await post({ phone: f.phone, password }).expect(200);
    await post({ email: f.email, password }).expect(200);
    await api().post('/api/v1/public/auth/reset-password')
      .send({ sessionToken: verified.body.sessionToken, newPassword: 'SecondFixturePassword123!' }).expect(401);
  });

  it('rejects unknown, wrong-password and inactive identities without issuing sessions', async () => {
    const wrong = await account();
    const inactive = await account({ active: false });
    const linkedInactive = await account({ linkedInactive: true });
    for (const body of [
      { email: `${prefix}-unknown@example.test`, password },
      { email: wrong.email, password: 'WrongPassword123!' },
      { email: inactive.email, password },
      { phone: linkedInactive.phone, password },
    ]) {
      const response = await post(body).expect(401);
      expect(response.body).not.toHaveProperty('tokens');
      expect(response.body.message).toBe('Invalid credentials');
    }
    expect(await prisma.clientRefreshToken.count({ where: { clientId: { in: [wrong.client.id, inactive.client.id, linkedInactive.client.id] } } })).toBe(0);
  });

  it('creates a password using an already verified linked email without attaching a new Client email', async () => {
    const f = await account({ noPassword: true, legacyEmail: true });
    const api = () => request(app.getHttpServer());
    const proof = { channel: 'EMAIL', identifier: ` ${f.email.toUpperCase()} `, purpose: 'CLIENT_PASSWORD_RESET' };
    await api().post('/api/v1/public/otp/request').send(proof).expect(200);
    const verified = await api().post('/api/v1/public/otp/verify')
      .send({ ...proof, code: capturedCodes.get(f.email) }).expect(200);
    await api().post('/api/v1/public/auth/reset-password')
      .send({ sessionToken: verified.body.sessionToken, newPassword: password }).expect(204);
    const saved = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
    expect(saved.email).toBeNull();
    expect(saved.emailVerified).toBeNull();
    await post({ email: f.email, password }).expect(200);
  });

  it('rejects ambiguous input and respects an existing lockout', async () => {
    const f = await account();
    await post({ email: f.email, phone: f.phone, password }).expect(400);
    await prisma.client.update({ where: { id: f.client.id }, data: { lockoutUntil: new Date(Date.now() + 60_000) } });
    await post({ phone: f.phone, password }).expect(401);
    expect(await prisma.clientRefreshToken.count({ where: { clientId: f.client.id } })).toBe(0);
  });

  it('does not reset or verify a phone changed while the password is being hashed', async () => {
    const f = await account({ noPassword: true, unverifiedPhone: true });
    const api = () => request(app.getHttpServer());
    const proof = { channel: 'SMS', identifier: f.phone, purpose: 'CLIENT_PASSWORD_RESET' };
    await api().post('/api/v1/public/otp/request').send(proof).expect(200);
    const verified = await api().post('/api/v1/public/otp/verify')
      .send({ ...proof, code: capturedCodes.get(f.phone) }).expect(200);
    const originalHash = passwords.hash.bind(passwords);
    const changedPhone = `+96655${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
    const hashSpy = jest.spyOn(PasswordService.prototype, 'hash').mockImplementationOnce(async (plain: string) => {
      await prisma.client.update({ where: { id: f.client.id }, data: { phone: changedPhone, phoneVerified: null } });
      return originalHash(plain);
    });
    try {
      await api().post('/api/v1/public/auth/reset-password')
        .send({ sessionToken: verified.body.sessionToken, newPassword: password }).expect(401);
      const saved = await prisma.client.findUniqueOrThrow({ where: { id: f.client.id } });
      expect(saved.phone).toBe(changedPhone);
      expect(saved.passwordHash).toBeNull();
      expect(saved.phoneVerified).toBeNull();
      expect(saved.tokenVersion).toBe(0);
    } finally { hashSpy.mockRestore(); }
  });
});
