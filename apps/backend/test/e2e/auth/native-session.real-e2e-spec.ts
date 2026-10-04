/**
 * Native mobile refresh/logout persistence and concurrency regressions.
 *
 * This suite is skipped unless REAL_E2E_DATABASE_URL points at a migrated,
 * disposable Postgres database. It calls real HTTP routes and Prisma-backed handlers;
 * only the token service is spied on for the rollback failure injection.
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/infrastructure/database';
import { configureHttpContract } from '../../../src/common/bootstrap/configure-http-contract';
import { NativeLogoutHandler } from '../../../src/modules/identity/native-session/native-logout.handler';
import { NativeRefreshHandler } from '../../../src/modules/identity/native-session/native-refresh.handler';
import { TokenService, type TokenPair } from '../../../src/modules/identity/shared/token.service';

const describeRealE2e = process.env.REAL_E2E_DATABASE_URL ? describe : describe.skip;

describeRealE2e('Native session refresh/logout — real Postgres e2e', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let prisma: PrismaService;
  let tokenService: TokenService;
  let refreshHandler: NativeRefreshHandler;
  let logoutHandler: NativeLogoutHandler;

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `native-session-${suffix}@sawaa.test`;
  let userId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.REAL_E2E_DATABASE_URL!;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    configureHttpContract(app, 'production');
    await app.init();

    prisma = app.get(PrismaService);
    tokenService = app.get(TokenService);
    refreshHandler = app.get(NativeRefreshHandler);
    logoutHandler = app.get(NativeLogoutHandler);
    await prisma.$queryRaw`SELECT 1`;

    const user = await prisma.user.create({
      data: {
        email,
        name: 'Native Session E2E',
        role: 'EMPLOYEE',
        isActive: true,
      },
      select: { id: true },
    });
    userId = user.id;
    // Staff mobile sessions are for practitioners linked to an active Employee.
    await prisma.employee.create({ data: { userId, name: 'Native Session E2E' } });
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.employee.deleteMany({ where: { userId } }).catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    if (app) await app.close();
  });

  async function issuePair(): Promise<TokenPair> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customRole: { include: { permissions: true } } },
    });
    if (!user) throw new Error('native-session e2e fixture user was deleted');
    return tokenService.issueTokenPair(user, { isSuperAdmin: false });
  }

  async function activeTokens() {
    return prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('allows exactly one winner when two refresh requests race on one token', async () => {
    const pair = await issuePair();

    const results = await Promise.allSettled([
      refreshHandler.execute(pair.refreshToken),
      refreshHandler.execute(pair.refreshToken),
    ]);
    const fulfilled = results.filter((result): result is PromiseFulfilledResult<TokenPair> => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(await activeTokens()).toHaveLength(1);
  });

  it('rolls back token consumption when replacement issuance fails', async () => {
    const pair = await issuePair();
    const issueSpy = jest
      .spyOn(TokenService.prototype, 'issueTokenPair')
      .mockRejectedValueOnce(new Error('injected native issuance failure'));

    try {
      await expect(refreshHandler.execute(pair.refreshToken)).rejects.toThrow('injected native issuance failure');
    } finally {
      issueSpy.mockRestore();
    }

    const consumed = await prisma.refreshToken.findFirst({
      where: { userId, tokenSelector: pair.refreshToken.slice(0, 8) },
      orderBy: { createdAt: 'desc' },
    });
    expect(consumed?.revokedAt).toBeNull();
    await expect(refreshHandler.execute(pair.refreshToken)).resolves.toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('makes logout first prevent a refresh using the consumed token', async () => {
    const pair = await issuePair();
    await logoutHandler.execute(pair.refreshToken);

    await expect(refreshHandler.execute(pair.refreshToken)).rejects.toThrow();
    expect(await activeTokens()).toHaveLength(0);
  });

  it('revokes the rotated token when refresh finishes before logout', async () => {
    const pair = await issuePair();
    const rotated = await refreshHandler.execute(pair.refreshToken);

    await logoutHandler.execute(rotated.refreshToken);
    await expect(refreshHandler.execute(rotated.refreshToken)).rejects.toThrow();
    expect(await activeTokens()).toHaveLength(0);
  });

  it('does not let duplicate historical logout invalidate a fresh login', async () => {
    const historical = await issuePair();
    await logoutHandler.execute(historical.refreshToken);

    const fresh = await issuePair();
    await logoutHandler.execute(historical.refreshToken);

    await expect(refreshHandler.execute(fresh.refreshToken)).resolves.toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('rejects a legacy NULL-source token at dashboard HTTP refresh while retaining eligible native rotation', async () => {
    const legacy = await issuePair();
    const legacyRow = await prisma.refreshToken.findFirstOrThrow({
      where: { userId, tokenSelector: legacy.refreshToken.slice(0, 8) },
    });
    await prisma.refreshToken.update({ where: { id: legacyRow.id }, data: { source: null } });
    const before = await prisma.refreshToken.findMany({ where: { userId }, orderBy: { id: 'asc' } });

    const rejected = await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', `ck_refresh=${legacy.refreshToken}`).send({});

    expect(rejected.status).toBe(401);
    expect(rejected.body.message).toBe('Invalid or expired refresh token');
    expect(rejected.body).not.toHaveProperty('accessToken');
    expect(rejected.headers['set-cookie']).toBeUndefined();
    // Row equality proves no consumption, replacement, or change to other
    // synthetic sessions belonging to this user on rejection.
    expect(await prisma.refreshToken.findMany({ where: { userId }, orderBy: { id: 'asc' } })).toEqual(before);

    const native = await request(app.getHttpServer()).post('/api/v1/mobile/auth/refresh')
      .send({ refreshToken: legacy.refreshToken }).expect(200);
    expect(native.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String) });
    expect((await prisma.refreshToken.findUniqueOrThrow({ where: { id: legacyRow.id } })).revokedAt).toBeInstanceOf(Date);
    const replacement = await prisma.refreshToken.findFirstOrThrow({
      where: { userId, tokenSelector: native.body.refreshToken.slice(0, 8) },
    });
    expect(replacement.source).toBe('MOBILE');
    expect(replacement.revokedAt).toBeNull();
    const afterNative = await prisma.refreshToken.findMany({ where: { userId }, orderBy: { id: 'asc' } });
    expect(afterNative).toHaveLength(before.length + 1);

    const rejectedReplacement = await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', `ck_refresh=${native.body.refreshToken}`).send({});
    expect(rejectedReplacement.status).toBe(401);
    expect(rejectedReplacement.headers['set-cookie']).toBeUndefined();
    expect(rejectedReplacement.body).not.toHaveProperty('accessToken');
    expect(await prisma.refreshToken.findMany({ where: { userId }, orderBy: { id: 'asc' } })).toEqual(afterNative);
  });

  it('rotates a known DASHBOARD token through the dashboard HTTP cookie route', async () => {
    const pair = await issuePair();
    const original = await prisma.refreshToken.findFirstOrThrow({
      where: { userId, tokenSelector: pair.refreshToken.slice(0, 8) },
    });
    expect(original.source).toBe('DASHBOARD');
    const rotated = await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', `ck_refresh=${pair.refreshToken}`).send({}).expect(200);

    expect(rotated.body.accessToken).toEqual(expect.any(String));
    expect(rotated.body).not.toHaveProperty('refreshToken');
    const cookieHeader = rotated.headers['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
    const cookie = cookies.find((value: string) => value.startsWith('ck_refresh='));
    expect(cookie).toContain('HttpOnly');
    const rawReplacement = cookie!.slice('ck_refresh='.length).split(';')[0];
    expect(rawReplacement).not.toBe(pair.refreshToken);
    expect((await prisma.refreshToken.findUniqueOrThrow({ where: { id: original.id } })).revokedAt).toBeInstanceOf(Date);
    const replacement = await prisma.refreshToken.findFirstOrThrow({
      where: { userId, tokenSelector: rawReplacement.slice(0, 8) },
    });
    expect(replacement.source).toBe('DASHBOARD');
    expect(replacement.revokedAt).toBeNull();
  });
});
