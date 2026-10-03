/**
 * Mobile Client identity — real Postgres HTTP regression coverage.
 *
 * The suite is intentionally gated by REAL_E2E_DATABASE_URL. It creates only
 * per-run synthetic User/Client/OTP/session rows and uses an in-memory SMS
 * adapter, so no provider is contacted. Run only against a disposable test
 * database; the coordinator owns the real-DB gate.
 */
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { SmsChannelAdapter } from '../../../src/modules/comms/notification-channel/sms-channel.adapter';
import { EmailChannelAdapter } from '../../../src/modules/comms/notification-channel/email-channel.adapter';
import { ClientTokenService } from '../../../src/modules/identity/shared/client-token.service';
import { PlatformSettingsService } from '../../../src/modules/platform/settings/platform-settings.service';
import { TokenService } from '../../../src/modules/identity/shared/token.service';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('Mobile Client identity — real HTTP e2e', () => {
  jest.setTimeout(90_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let clientTokens: ClientTokenService;
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const sentCodes = new Map<string, string>();
  const createdUserIds = new Set<string>();
  const createdClientIds = new Set<string>();
  const createdOtpIds = new Set<string>();
  const createdIdentifiers = new Set<string>();

  const phone = (label: string) => `+9665${String(Math.floor(10_000_000 + Math.random() * 89_999_999)).padStart(8, '0')}`;
  const email = (label: string) => `mobile-identity-${suffix}-${label}@sawaa.test`;
  const api = () => request(app.getHttpServer());
  const codeKey = (identifier: string, purpose: OtpPurpose) => `${identifier}:${purpose}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const sms = {
      kind: OtpChannel.SMS,
      send: jest.fn(async (identifier: string, code: string) => sentCodes.set(codeKey(identifier, OtpPurpose.MOBILE_LOGIN), code)),
    };
    const mail = {
      kind: OtpChannel.EMAIL,
      send: jest.fn(async (identifier: string, code: string) => sentCodes.set(codeKey(identifier, OtpPurpose.MOBILE_LOGIN), code)),
    };
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SmsChannelAdapter).useValue(sms)
      .overrideProvider(EmailChannelAdapter).useValue(mail)
      .compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    configureHttpContract(app, 'production');
    await app.init();
    prisma = app.get(PrismaService);
    clientTokens = app.get(ClientTokenService);
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    if (prisma) {
      const discoveredClients = await prisma.client.findMany({
        where: {
          OR: [
            { id: { in: [...createdClientIds] } },
            { userId: { in: [...createdUserIds] } },
            { email: { startsWith: `mobile-identity-${suffix}-` } },
          ],
        },
        select: { id: true },
      }).catch(() => []);
      for (const client of discoveredClients) createdClientIds.add(client.id);
      await prisma.fcmToken.deleteMany({ where: { clientId: { in: [...createdClientIds] } } }).catch(() => undefined);
      await prisma.clientRefreshToken.deleteMany({ where: { clientId: { in: [...createdClientIds] } } }).catch(() => undefined);
      await prisma.refreshToken.deleteMany({ where: { userId: { in: [...createdUserIds] } } }).catch(() => undefined);
      await prisma.otpCode.deleteMany({
        where: {
          OR: [
            ...(createdOtpIds.size ? [{ id: { in: [...createdOtpIds] } }] : []),
            ...(createdIdentifiers.size ? [{ identifier: { in: [...createdIdentifiers] } }] : []),
          ],
        },
      }).catch(() => undefined);
      await prisma.client.deleteMany({ where: { id: { in: [...createdClientIds] } } }).catch(() => undefined);
      await prisma.employee.deleteMany({ where: { userId: { in: [...createdUserIds] } } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: { in: [...createdUserIds] } } }).catch(() => undefined);
    }
    if (app) await app.close();
  });

  async function seedUser(opts: {
    label: string;
    role?: 'CLIENT' | 'RECEPTIONIST' | 'ADMIN' | 'EMPLOYEE';
    isSuperAdmin?: boolean;
    active?: boolean;
    phone?: string;
    email?: string;
    emailVerifiedAt?: Date | null;
  }) {
    const row = await prisma.user.create({
      data: {
        email: opts.email ?? email(opts.label), name: `Synthetic ${opts.label}`, role: opts.role ?? 'CLIENT',
        isSuperAdmin: opts.isSuperAdmin ?? false,
        isActive: opts.active ?? true, phone: opts.phone ?? phone(opts.label),
        phoneVerifiedAt: new Date(),
        emailVerifiedAt: opts.emailVerifiedAt ?? null,
      },
    });
    createdUserIds.add(row.id);
    return row;
  }

  async function linkPractitioner(userId: string, label: string) {
    return prisma.employee.create({ data: { userId, name: `Synthetic practitioner ${label}` } });
  }

  async function seedClient(opts: {
    label: string;
    userId?: string | null;
    active?: boolean;
    phone?: string;
    email?: string | null;
    phoneVerified?: Date | null;
  }) {
    const row = await prisma.client.create({
      data: {
        userId: opts.userId ?? null, phone: opts.phone ?? phone(opts.label), name: `Synthetic ${opts.label}`,
        email: opts.email ?? null,
        isActive: opts.active ?? true,
        phoneVerified: opts.phoneVerified === undefined ? new Date() : opts.phoneVerified,
        accountType: 'FULL',
      },
    });
    createdClientIds.add(row.id);
    return row;
  }

  async function requestLoginOtp(identifier: string) {
    createdIdentifiers.add(identifier);
    const res = await api().post('/api/v1/mobile/auth/request-login-otp').send({ identifier });
    expect(res.status).toBe(200);
    const key = codeKey(identifier, OtpPurpose.MOBILE_LOGIN);
    const code = sentCodes.get(key);
    expect(code).toMatch(/^\d{4}$/);
    return code!;
  }

  async function verify(identifier: string, code: string, purpose: 'login' | 'register' = 'login') {
    return api().post('/api/v1/mobile/auth/verify-otp').send({ identifier, code, purpose });
  }

  async function seedOtp(identifier: string, code: string) {
    createdIdentifiers.add(identifier);
    const row = await prisma.otpCode.create({
      data: {
        identifier, channel: OtpChannel.SMS, purpose: OtpPurpose.MOBILE_LOGIN,
        codeHash: await bcrypt.hash(code, 4), expiresAt: new Date(Date.now() + 60_000),
      },
    });
    createdOtpIds.add(row.id);
    return row;
  }

  async function issueClientPair(clientId: string) {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    return clientTokens.issueTokenPair({ id: client.id, email: client.email, tokenVersion: client.tokenVersion });
  }

  it('supports new registration and keeps the Client namespace on profile/bookings', async () => {
    const p = phone('new-registration');
    createdIdentifiers.add(p);
    const registration = await api().post('/api/v1/mobile/auth/register').send({
      firstName: 'Synthetic', lastName: 'Client', phone: p, email: email('new-registration'),
    });
    expect(registration.status).toBe(200);
    createdUserIds.add(registration.body.userId);
    const code = sentCodes.get(codeKey(p, OtpPurpose.MOBILE_LOGIN));
    expect(code).toMatch(/^\d{4}$/);
    const verified = await verify(p, code!, 'register');
    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('client');
    expect(verified.body.tokens).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    const client = await prisma.client.findFirstOrThrow({ where: { userId: registration.body.userId } });
    createdClientIds.add(client.id);
    const access = verified.body.tokens.accessToken;
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${access}`).expect(200);
    await api().get('/api/v1/mobile/client/bookings').set('Authorization', `Bearer ${access}`).expect(200);
    await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`).expect(401);
  });

  it('rejects a stale registration retry after HTTP OTP activation without changing identity or sending another OTP', async () => {
    const p = phone('registration-activation-race');
    createdIdentifiers.add(p);
    const originalIdentity = {
      firstName: 'Synthetic', lastName: 'Original', phone: p,
      email: email('reg-race'),
    };
    const registration = await api().post('/api/v1/mobile/auth/register').send(originalIdentity).expect(200);
    const userId = registration.body.userId as string;
    createdUserIds.add(userId);
    const code = sentCodes.get(codeKey(p, OtpPurpose.MOBILE_LOGIN));
    expect(code).toMatch(/^\d{4}$/);

    let snapshotRead!: () => void;
    let releaseRetry!: () => void;
    const readReached = new Promise<void>((resolve) => { snapshotRead = resolve; });
    const released = new Promise<void>((resolve) => { releaseRetry = resolve; });
    const originalFindMany = prisma.user.findMany.bind(prisma.user);
    let heldSnapshot = false;
    const interceptFindMany = async (args: Parameters<typeof originalFindMany>[0]) => {
      // Run the actual DB read, then delay only this registration request's
      // returned snapshot. OTP activation and all writes remain real.
      const rows = await originalFindMany(args);
      if (!heldSnapshot && args?.where?.OR?.some((condition) => condition.phone === p)) {
        heldSnapshot = true;
        snapshotRead();
        await released;
      }
      return rows;
    };
    // This test interceptor awaits the real PrismaPromise before holding its
    // result, so its ordinary Promise intentionally lacks Prisma's promise tag.
    const readSpy = jest.spyOn(prisma.user, 'findMany')
      .mockImplementation(interceptFindMany as unknown as typeof prisma.user.findMany);
    const retryPromise = api().post('/api/v1/mobile/auth/register').send({
      firstName: 'Replacement', lastName: 'Attempt', phone: p,
      email: email('reg-race-retry'),
    }).timeout({ deadline: 15_000 }).then((response) => response);
    // Attach a rejection handler immediately while waiting for the barrier.
    void retryPromise.catch(() => undefined);
    let barrierTimeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        readReached,
        new Promise<never>((_resolve, reject) => {
          barrierTimeout = setTimeout(() => reject(new Error('Registration retry did not reach its pending read')), 10_000);
        }),
      ]);
      clearTimeout(barrierTimeout);
      const activated = await api().post('/api/v1/mobile/auth/verify-otp')
        .send({ identifier: p, code, purpose: 'register' }).timeout({ deadline: 10_000 }).expect(200);
      expect(activated.body.sessionKind).toBe('client');
      const activeUser = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(activeUser).toMatchObject({ ...originalIdentity, name: 'Synthetic Original', isActive: true });
      expect(activeUser.phoneVerifiedAt).toBeInstanceOf(Date);
      const activeClient = await prisma.client.findFirstOrThrow({ where: { userId } });
      createdClientIds.add(activeClient.id);
      const otpRows = await prisma.otpCode.findMany({ where: { identifier: p }, orderBy: { id: 'asc' } });
      const smsSend = jest.mocked(app.get(SmsChannelAdapter).send);
      const dispatchCount = smsSend.mock.calls.filter(([identifier]) => identifier === p).length;

      releaseRetry();
      const retried = await retryPromise;

      expect(retried.status).toBe(409);
      expect(retried.body.message).toBe('Account already exists');
      expect(await prisma.user.findUniqueOrThrow({ where: { id: userId } })).toEqual(activeUser);
      expect(await prisma.client.findMany({ where: { userId } })).toEqual([activeClient]);
      expect(await prisma.otpCode.findMany({ where: { identifier: p }, orderBy: { id: 'asc' } })).toEqual(otpRows);
      expect(smsSend.mock.calls.filter(([identifier]) => identifier === p)).toHaveLength(dispatchCount);
    } finally {
      clearTimeout(barrierTimeout);
      releaseRetry();
      await retryPromise.catch(() => undefined);
      readSpy.mockRestore();
    }
  });

  it('lazily links a legacy User.CLIENT with no Client only after a phone OTP', async () => {
    const u = await seedUser({ label: 'legacy-unlinked' });
    const code = await requestLoginOtp(u.phone!);
    const verified = await verify(u.phone!, code);
    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('client');
    const linked = await prisma.client.findMany({ where: { userId: u.id } });
    expect(linked).toHaveLength(1);
    createdClientIds.add(linked[0].id);
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${verified.body.tokens.accessToken}`).expect(200);
  });

  it('links an unlinked Client matched by the same phone and email without creating another Client', async () => {
    const p = phone('same-phone-email');
    const u = await seedUser({ label: 'same-phone-email-user', phone: p, emailVerifiedAt: new Date() });
    const candidate = await seedClient({
      label: 'same-phone-email-client',
      phone: p,
      email: u.email,
      phoneVerified: new Date(),
    });
    const before = await prisma.client.count({ where: { phone: p } });

    const code = await requestLoginOtp(p);
    const verified = await verify(p, code);

    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('client');
    const rows = await prisma.client.findMany({ where: { phone: p } });
    expect(rows).toHaveLength(before);
    expect(rows[0].id).toBe(candidate.id);
    expect(rows[0].userId).toBe(u.id);
  });

  it('supports verified email OTP for an explicit User.CLIENT link', async () => {
    const userEmail = email('explicit-email-link-user');
    const u = await seedUser({
      label: 'explicit-email-link-user',
      email: userEmail,
      emailVerifiedAt: new Date(),
    });
    const linked = await seedClient({
      label: 'explicit-email-link-client',
      userId: u.id,
      email: userEmail,
      phone: phone('explicit-email-link-client'),
      phoneVerified: new Date(),
    });

    const code = await requestLoginOtp(userEmail);
    const verified = await verify(userEmail, code);

    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('client');
    expect(verified.body.tokens).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    const rows = await prisma.client.findMany({ where: { userId: u.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(linked.id);
  });

  it('supports an existing Client-only phone, including an initially unverified phone', async () => {
    const c = await seedClient({ label: 'client-only', phoneVerified: null });
    const code = await requestLoginOtp(c.phone!);
    const verified = await verify(c.phone!, code);
    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('client');
    const after = await prisma.client.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.phoneVerified).toBeInstanceOf(Date);
    expect(after.userId).toBeNull();
  });

  it('verifies the replacement OTP after a second login-code request', async () => {
    const c = await seedClient({ label: 'replacement-otp' });
    await requestLoginOtp(c.phone!);
    const firstOtp = await prisma.otpCode.findFirstOrThrow({
      where: { identifier: c.phone!, purpose: OtpPurpose.MOBILE_LOGIN },
      orderBy: { createdAt: 'desc' },
    });
    createdOtpIds.add(firstOtp.id);

    const secondCode = await requestLoginOtp(c.phone!);
    const secondOtp = await prisma.otpCode.findFirstOrThrow({
      where: { identifier: c.phone!, purpose: OtpPurpose.MOBILE_LOGIN },
      orderBy: { createdAt: 'desc' },
    });
    createdOtpIds.add(secondOtp.id);

    expect(secondOtp.id).not.toBe(firstOtp.id);
    expect(secondOtp.consumedAt).toBeNull();
    expect((await prisma.otpCode.findUniqueOrThrow({ where: { id: firstOtp.id } })).consumedAt).toBeInstanceOf(Date);
    const verified = await verify(c.phone!, secondCode);
    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('client');
  });

  it('keeps staff OTP in the User namespace and rejects each namespace at the opposite guard', async () => {
    const u = await seedUser({ label: 'staff', role: 'EMPLOYEE' });
    await linkPractitioner(u.id, 'staff');
    const code = await requestLoginOtp(u.phone!);
    const verified = await verify(u.phone!, code);
    expect(verified.status).toBe(200);
    expect(verified.body.sessionKind).toBe('staff');
    await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${verified.body.tokens.accessToken}`).expect(200);
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${verified.body.tokens.accessToken}`).expect(401);
    // A mobile-issued staff refresh token cannot be rotated through the dashboard cookie route.
    const staffRefresh = verified.body.tokens.refreshToken as string;
    const dashboardRefresh = await api().post('/api/v1/auth/refresh').set('Cookie', `ck_refresh=${staffRefresh}`).send({});
    expect(dashboardRefresh.status).toBe(401);
    expect(dashboardRefresh.body.message).toBe('Invalid or expired refresh token');
    await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: staffRefresh }).expect(200);
    const sources = await prisma.refreshToken.findMany({ where: { userId: u.id }, select: { source: true } });
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((row) => row.source === 'MOBILE')).toBe(true);
    const client = await seedClient({ label: 'opposite-guard' });
    const pair = await issueClientPair(client.id);
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${pair.accessToken}`).expect(200);
    await api().get('/api/v1/auth/me').set('Authorization', `Bearer ${pair.accessToken}`).expect(401);
  });

  it('refuses OTP-only mobile login for a super-admin while two-factor is required', async () => {
    const admin = await seedUser({ label: 'super-admin-2fa', role: 'ADMIN', isSuperAdmin: true });
    await linkPractitioner(admin.id, 'super-admin-2fa');
    const settings = app.get(PlatformSettingsService);
    const twoFactorKey = 'security.twoFactor.required';
    const previous = await prisma.platformSetting.findUnique({ where: { key: twoFactorKey } });
    try {
      await settings.set(twoFactorKey, true);
      const requested = await api().post('/api/v1/mobile/auth/request-login-otp').send({ identifier: admin.phone });
      expect(requested.status).toBe(200);
      expect(sentCodes.has(codeKey(admin.phone!, OtpPurpose.MOBILE_LOGIN))).toBe(false);

      // Even with a valid code planted directly, verify must not issue staff tokens.
      const planted = await seedOtp(admin.phone!, '4242');
      const verified = await verify(admin.phone!, '4242');
      expect(verified.status).toBe(401);
      expect(verified.body.tokens).toBeUndefined();
      expect((await prisma.otpCode.findUniqueOrThrow({ where: { id: planted.id } })).consumedAt).toBeNull();

      // Control: the same account signs in once two-factor is not required.
      await settings.set(twoFactorKey, false);
      const verifiedWithout2fa = await verify(admin.phone!, '4242');
      expect(verifiedWithout2fa.status).toBe(200);
      expect(verifiedWithout2fa.body.sessionKind).toBe('staff');
    } finally {
      if (previous) {
        await prisma.platformSetting.update({ where: { key: twoFactorKey }, data: { value: previous.value, isSecret: previous.isSecret } });
      } else {
        await prisma.platformSetting.deleteMany({ where: { key: twoFactorKey } });
      }
    }
  });

  it('refuses mobile refresh for staff without a practitioner record and revokes the token', async () => {
    const reception = await seedUser({ label: 'reception-refresh', role: 'RECEPTIONIST' });
    const pair = await app.get(TokenService).issueTokenPair({ ...reception, customRole: null }, { isSuperAdmin: false });
    const refreshed = await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: pair.refreshToken });
    expect(refreshed.status).toBe(401);
    expect(await prisma.refreshToken.count({ where: { userId: reception.id, revokedAt: null } })).toBe(0);
  });

  it('refuses mobile OTP login for staff without a practitioner record', async () => {
    const reception = await seedUser({ label: 'reception-no-practitioner', role: 'RECEPTIONIST' });
    const requested = await api().post('/api/v1/mobile/auth/request-login-otp').send({ identifier: reception.phone });
    expect(requested.status).toBe(200);
    expect(sentCodes.has(codeKey(reception.phone!, OtpPurpose.MOBILE_LOGIN))).toBe(false);

    const planted = await seedOtp(reception.phone!, '5151');
    const verified = await verify(reception.phone!, '5151');
    expect(verified.status).toBe(401);
    expect(verified.body.tokens).toBeUndefined();
    expect((await prisma.otpCode.findUniqueOrThrow({ where: { id: planted.id } })).consumedAt).toBeNull();
  });

  it('rotates a client refresh token once, then logout revokes access, refresh, and FCM state', async () => {
    const c = await seedClient({ label: 'rotation' });
    const initial = await issueClientPair(c.id);
    await prisma.fcmToken.create({ data: { clientId: c.id, token: `synthetic-${suffix}`, platform: 'ios' } });
    const rotated = await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: initial.rawRefresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: initial.rawRefresh }).expect(401);
    await api().post('/api/v1/mobile/auth/logout').send({ refreshToken: rotated.body.refreshToken }).expect(204);
    await api().get('/api/v1/mobile/client/profile').set('Authorization', `Bearer ${rotated.body.accessToken}`).expect(401);
    await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: rotated.body.refreshToken }).expect(401);
    expect(await prisma.fcmToken.count({ where: { clientId: c.id } })).toBe(0);
  });

  it('does not let an old logout replay revoke a newer client family', async () => {
    const c = await seedClient({ label: 'logout-epoch' });
    const old = await issueClientPair(c.id);
    await api().post('/api/v1/mobile/auth/logout').send({ refreshToken: old.rawRefresh }).expect(204);
    const fresh = await issueClientPair(c.id);
    await api().post('/api/v1/mobile/auth/logout').send({ refreshToken: old.rawRefresh }).expect(204);
    await api().post('/api/v1/mobile/auth/refresh').send({ refreshToken: fresh.rawRefresh }).expect(200);
  });

  it('fails closed for disabled customers and preserves OTP failure counters', async () => {
    const c = await seedClient({ label: 'disabled-after-request' });
    const code = await requestLoginOtp(c.phone!);
    await prisma.client.update({ where: { id: c.id }, data: { isActive: false } });
    const disabled = await verify(c.phone!, code);
    expect(disabled.status).toBe(401);

    const alreadyDisabled = await seedClient({ label: 'disabled-request', active: false });
    const disabledRequest = await api().post('/api/v1/mobile/auth/request-login-otp').send({ identifier: alreadyDisabled.phone });
    expect(disabledRequest.status).toBe(200);
    expect(sentCodes.has(codeKey(alreadyDisabled.phone!, OtpPurpose.MOBILE_LOGIN))).toBe(false);

    const active = await seedClient({ label: 'wrong-code' });
    await requestLoginOtp(active.phone!);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await verify(active.phone!, '0000');
      expect(wrong.status).toBeGreaterThanOrEqual(400);
    }
    const otp = await prisma.otpCode.findFirstOrThrow({ where: { identifier: active.phone!, purpose: OtpPurpose.MOBILE_LOGIN }, orderBy: { createdAt: 'desc' } });
    createdOtpIds.add(otp.id);
    expect(otp.attempts).toBe(5);
    expect(otp.consumedAt).toBeNull();
  });

  it('rejects a conflicting explicit client link without consuming the proof or overwriting identity', async () => {
    const p = phone('conflict');
    const u = await seedUser({ label: 'conflict-user', phone: p });
    const linked = await seedClient({ label: 'conflict-linked', userId: u.id, phone: phone('different-linked') });
    const code = '2468';
    const seededOtp = await seedOtp(p, code);
    const result = await verify(p, code);
    expect(result.status).toBe(409);
    const after = await prisma.otpCode.findUniqueOrThrow({ where: { id: seededOtp.id } });
    expect(after.consumedAt).toBeNull();
    expect((await prisma.client.findUniqueOrThrow({ where: { id: linked.id } })).phone).not.toBe(p);
  });

  it('allows only one winner when identical client OTP verification races', async () => {
    const c = await seedClient({ label: 'otp-race' });
    const code = await requestLoginOtp(c.phone!);
    const results = await Promise.all([verify(c.phone!, code), verify(c.phone!, code)]);
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status >= 400)).toHaveLength(1);
    expect(await prisma.clientRefreshToken.count({ where: { clientId: c.id, revokedAt: null } })).toBe(1);
  });
});
