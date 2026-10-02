/**
 * Single-use credentials under concurrency — real Postgres regression.
 *
 * A dashboard OTP, a staff password-reset link and an email-verification link
 * are each submitted several times at once. Every request passes the read-side
 * checks before any of them consumes the row, so only the conditional consume
 * (`updateMany ... consumedAt: null`) decides the winner. Exactly one request
 * may succeed; the others must fail without side effects.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHash, randomBytes } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { RedisService } from '../../../src/infrastructure/cache/redis.service';
import { VerifyDashboardOtpHandler } from '../../../src/modules/identity/verify-dashboard-otp/verify-dashboard-otp.handler';
import { PerformPasswordResetHandler } from '../../../src/modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler';
import { VerifyEmailHandler } from '../../../src/modules/identity/verify-email/verify-email.handler';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

const PARALLEL = 5;

/** In-memory stand-in for the failed-attempt counter the OTP verifier keeps in Redis. */
function fakeRedisClient() {
  const store = new Map<string, number>();
  const chain = {
    incr: (key: string) => { store.set(key, (store.get(key) ?? 0) + 1); return chain; },
    expire: () => chain,
    exec: async () => [],
  };
  return {
    get: async (key: string) => (store.has(key) ? String(store.get(key)) : null),
    del: async (key: string) => { store.delete(key); return 1; },
    multi: () => chain,
  };
}

function settle<T>(count: number, run: (i: number) => Promise<T>) {
  return Promise.allSettled(Array.from({ length: count }, (_, i) => run(i)));
}

function rawToken() {
  const token = randomBytes(32).toString('hex');
  return {
    token,
    tokenSelector: token.slice(0, 8),
    tokenHash: createHash('sha256').update(token).digest('hex'),
  };
}

describeRealE2e('Single-use credentials under concurrency — real-DB e2e', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `single-use-race-${suffix}@sawaa.test`;
  let userId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    jest.spyOn(app.get(RedisService), 'getClient').mockReturnValue(fakeRedisClient() as never);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash('OldPass1', 4),
        name: 'Single Use',
        role: 'RECEPTIONIST',
        isActive: true,
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.otpCode.deleteMany({ where: { identifier: email } }).catch(() => undefined);
      await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { email } }).catch(() => undefined);
    }
    jest.restoreAllMocks();
    if (app) await app.close();
  });

  it('a dashboard OTP signs in exactly once', async () => {
    await prisma.otpCode.create({
      data: {
        channel: OtpChannel.EMAIL,
        identifier: email,
        codeHash: await bcrypt.hash('123456', 4),
        purpose: OtpPurpose.DASHBOARD_LOGIN,
        expiresAt: new Date(Date.now() + 5 * 60_000),
      },
    });
    const sessionsBefore = await prisma.refreshToken.count({ where: { userId } });
    const handler = app.get(VerifyDashboardOtpHandler);

    const results = await settle(PARALLEL, () => handler.execute({ identifier: email, code: '123456' }));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.refreshToken.count({ where: { userId } })).toBe(sessionsBefore + 1);
  });

  it('a password-reset link changes the password exactly once', async () => {
    const link = rawToken();
    await prisma.passwordResetToken.create({
      data: { userId, tokenSelector: link.tokenSelector, tokenHash: link.tokenHash, expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenVersion: true } });
    const handler = app.get(PerformPasswordResetHandler);

    const results = await settle(PARALLEL, (i) => handler.execute({ token: link.token, newPassword: `NewPass${i}x` }));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { tokenVersion: true } });
    expect(after.tokenVersion).toBe(before.tokenVersion + 1);
  });

  it('an email-verification link is consumed exactly once', async () => {
    const link = rawToken();
    await prisma.emailVerificationToken.create({
      data: { userId, tokenSelector: link.tokenSelector, tokenHash: link.tokenHash, expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    const handler = app.get(VerifyEmailHandler);

    const results = await settle(PARALLEL, () => handler.execute({ token: link.token }));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
