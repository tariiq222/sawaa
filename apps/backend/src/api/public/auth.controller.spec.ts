import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthController } from './auth.controller';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { PrismaService, RlsTransactionService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';
import { ConfigService } from '@nestjs/config';
import { RequestPasswordResetHandler } from '../../modules/identity/user-password-reset/request-password-reset/request-password-reset.handler';
import { PerformPasswordResetHandler } from '../../modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler';
import { RequestDashboardOtpHandler } from '../../modules/identity/request-dashboard-otp/request-dashboard-otp.handler';
import { VerifyDashboardOtpHandler } from '../../modules/identity/verify-dashboard-otp/verify-dashboard-otp.handler';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { JwtGuard, IS_PUBLIC_KEY } from '../../common/guards/jwt.guard';
import { AuthResponseBuilder } from '../../modules/identity/shared/auth-response.builder';
import { LookupUserHandler } from '../../modules/identity/lookup-user/lookup-user.handler';

function findSetCookie(
  headers: { 'set-cookie'?: string | string[] },
  prefix: string,
): string | undefined {
  const raw = headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return cookies.find((cookie) => cookie.startsWith(prefix));
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let tokenHash: string;

  const mockLogin = { execute: jest.fn() };
  const mockLogout = { execute: jest.fn() };
  const mockTokens = { issueTokenPair: jest.fn() };
  const mockGetCurrentUser = { execute: jest.fn() };
  const mockChangePassword = { execute: jest.fn() };
  const mockConfig = { get: jest.fn(), getOrThrow: jest.fn() };
  const mockRequestPasswordReset = { execute: jest.fn() };
  const mockPerformPasswordReset = { execute: jest.fn() };
  const mockRequestDashboardOtp = { execute: jest.fn() };
  const mockVerifyDashboardOtp = { execute: jest.fn() };
  const mockLookupUser = { execute: jest.fn() };

  beforeAll(async () => {
    tokenHash = await bcrypt.hash('raw-token', 10);
  });

  const buildMockPrisma = () => {
    const db = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    refreshToken: {
      findMany: jest.fn(),
      update: jest.fn(),
      // P1: conditional updateMany prevents refresh-token reuse race.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    // P1-8: login/me now load DB system-role permissions (mirrors JwtStrategy).
    customRole: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { ...db, $transaction: jest.fn(async (work: (tx: typeof db) => unknown) => work(db)) };
  };

  const buildApp = async (mockPrisma: any, jwtGuardValue: any, useRealLogoutHandler = false) => {
    const logoutProvider = useRealLogoutHandler
      ? { provide: LogoutHandler, useClass: LogoutHandler }
      : { provide: LogoutHandler, useValue: mockLogout };
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginHandler, useValue: mockLogin },
        logoutProvider,
        { provide: PrismaService, useValue: mockPrisma },
        RlsTransactionService,
        { provide: TokenService, useValue: mockTokens },
        { provide: GetCurrentUserHandler, useValue: mockGetCurrentUser },
        { provide: ChangePasswordHandler, useValue: mockChangePassword },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestPasswordResetHandler, useValue: mockRequestPasswordReset },
        { provide: PerformPasswordResetHandler, useValue: mockPerformPasswordReset },
        { provide: RequestDashboardOtpHandler, useValue: mockRequestDashboardOtp },
        { provide: VerifyDashboardOtpHandler, useValue: mockVerifyDashboardOtp },
        // Use the real builder so this HTTP suite exercises the response
        // boundary that must remove the refresh credential before serialization.
        AuthResponseBuilder,
        { provide: LookupUserHandler, useValue: mockLookupUser },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue(jwtGuardValue)
      .compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.use(cookieParser());
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nestApp.init();
    return nestApp;
  };

  beforeEach(async () => {
    const mockPrisma = buildMockPrisma();
    app = await buildApp(mockPrisma, {
      canActivate: (ctx: any) => {
        const req = ctx.switchToHttp().getRequest();
        req.user = {
          sub: 'user-1',
          id: 'user-1',
          email: 'test@example.com',
          role: 'ADMIN',
          isSuperAdmin: false,
          organizationId: '00000000-0000-0000-0000-000000000001',
        };
        return true;
      },
    });
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    it('returns the access token and user without exposing refreshToken', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'acc-token',
        refreshToken: 'ref-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          isActive: true,
          role: 'ADMIN',
          isSuperAdmin: false,
          customRole: null,
        },
      });
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL') return '30d';
        return defaultValue;
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123' })
        .expect(200);

      expect(res.body.accessToken).toBe('acc-token');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body).not.toHaveProperty('refreshToken');

      const refreshCookie = findSetCookie(res.headers, 'ck_refresh=');
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Secure');
      expect(refreshCookie).toContain('SameSite=Lax');
      expect(refreshCookie).toContain('Path=/');
    });

    it('returns 400 for invalid email format', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'SecurePass123' })
        .expect(400);
    });

    it('returns 400 for short password', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'short' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123', extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /auth/otp/verify-dashboard', () => {
    it('keeps the refresh token cookie-only', async () => {
      mockVerifyDashboardOtp.execute.mockResolvedValue({
        accessToken: 'otp-access-token',
        refreshToken: 'otp-refresh-token',
        expiresIn: 900,
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          phone: null,
          gender: null,
          avatarUrl: null,
          isActive: true,
          role: 'ADMIN',
          isSuperAdmin: false,
          firstName: 'Test',
          lastName: 'User',
          permissions: [],
        },
      });
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_REFRESH_TTL') return '30d';
        return defaultValue;
      });

      const res = await request(app.getHttpServer())
        .post('/auth/otp/verify-dashboard')
        .send({ identifier: 'test@example.com', code: '123456' })
        .expect(200);

      expect(res.body.accessToken).toBe('otp-access-token');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body).not.toHaveProperty('refreshToken');
      const refreshCookie = findSetCookie(res.headers, 'ck_refresh=');
      expect(refreshCookie).toContain('ck_refresh=otp-refresh-token');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Secure');
      expect(refreshCookie).toContain('SameSite=Lax');
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates from the cookie only and does not return either refresh token in JSON', async () => {
      const mockPrisma = buildMockPrisma();
      const record = {
        id: 'rt-1',
        tokenHash,
        tokenSelector: 'raw-toke',
        userId: 'user-1',
        revokedAt: null as Date | null,
        expiresAt: new Date(Date.now() + 86400000),
      };
      mockPrisma.refreshToken.findMany.mockImplementation(async () =>
        record.revokedAt ? [] : [record],
      );
      mockPrisma.refreshToken.updateMany.mockImplementation(async ({ where }: any) => {
        if (where.id === record.id && record.revokedAt === null) {
          record.revokedAt = new Date();
          return { count: 1 };
        }
        return { count: 0 };
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, isSuperAdmin: false, customRole: null });
      mockTokens.issueTokenPair.mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });
      mockConfig.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'JWT_ACCESS_TTL') return '15m';
        if (key === 'JWT_REFRESH_TTL') return '30d';
        return defaultValue;
      });

      const refreshApp = await buildApp(mockPrisma, { canActivate: () => true });

      const res = await request(refreshApp.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'ck_refresh=raw-token')
        .send({})
        .expect(200);

      expect(res.body.accessToken).toBe('new-acc');
      expect(res.body).not.toHaveProperty('refreshToken');
      const refreshCookie = findSetCookie(res.headers, 'ck_refresh=');
      expect(refreshCookie).toContain('ck_refresh=new-ref');
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Secure');
      expect(refreshCookie).toContain('SameSite=Lax');

      // Rotation consumes the presented cookie; replaying it must not mint a
      // second access token even though the request body is otherwise valid.
      await request(refreshApp.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'ck_refresh=raw-token')
        .send({})
        .expect(401);
      await refreshApp.close();
    });

    it('returns 401 when refreshToken cookie is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(401);

      expect(res.body.message).toContain('No refresh token');
    });

    it('has one winner when two requests rotate the same refresh token concurrently', async () => {
      const mockPrisma = buildMockPrisma();
      const rawToken = 'raw-token';
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-same-token',
          tokenHash,
          tokenSelector: 'raw-toke',
          userId: 'user-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockPrisma.refreshToken.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        isSuperAdmin: false,
        customRole: null,
      });
      mockTokens.issueTokenPair.mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });
      mockConfig.get.mockReturnValue('15m');

      const concurrentApp = await buildApp(mockPrisma, { canActivate: () => true });
      await concurrentApp.listen(0, "127.0.0.1");
      const responses = await Promise.all([
        request(concurrentApp.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', `ck_refresh=${rawToken}`),
        request(concurrentApp.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', `ck_refresh=${rawToken}`),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([200, 401]);
      expect(mockTokens.issueTokenPair).toHaveBeenCalledTimes(1);
      await concurrentApp.close();
    });

  });

  describe('GET /auth/me', () => {
    it('returns 200 with current user profile', async () => {
      mockGetCurrentUser.execute.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
        isSuperAdmin: false,
        permissions: [{ action: 'manage', subject: 'Booking' }],
      });

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.email).toBe('test@example.com');
      expect(res.body.permissions).toBeDefined();
    });

    it('returns 403 when guard rejects', async () => {
      const mockPrisma = buildMockPrisma();
      const guardedApp = await buildApp(mockPrisma, {
        canActivate: () => false,
      });

      await request(guardedApp.getHttpServer())
        .get('/auth/me')
        .expect(403);

      await guardedApp.close();
    });
  });

  describe('POST /auth/logout', () => {
    it('clears the cookie, revokes the session, and rejects reuse', async () => {
      const mockPrisma = buildMockPrisma();
      const record = {
        id: 'rt-logout',
        tokenHash,
        tokenSelector: 'raw-toke',
        userId: 'user-1',
        revokedAt: null as Date | null,
        expiresAt: new Date(Date.now() + 86400000),
      };
      mockPrisma.refreshToken.findMany.mockImplementation(async () =>
        record.revokedAt ? [] : [record],
      );
      let tokenVersion = 0;
      mockPrisma.refreshToken.updateMany.mockImplementation(async ({ where }: any) => {
        if (where.userId === 'user-1' && record.revokedAt === null) {
          record.revokedAt = new Date();
          return { count: 1 };
        }
        return { count: 0 };
      });
      mockPrisma.user.update.mockImplementation(async ({ data }: any) => {
        tokenVersion += data.tokenVersion.increment;
        return { id: 'user-1', tokenVersion };
      });

      const logoutApp = await buildApp(mockPrisma, { canActivate: () => true }, true);

      const logoutResponse = await request(logoutApp.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', 'ck_refresh=raw-token')
        .send({ refreshToken: 'body-token-ignored' })
        .expect(200);
      expect(record.revokedAt).toEqual(expect.any(Date));
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { tokenVersion: { increment: 1 } },
      });
      expect(tokenVersion).toBe(1);
      expect(logoutResponse.headers['set-cookie']).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/^ck_refresh=;/),
          expect.stringContaining('Path=/'),
        ]),
      );

      await request(logoutApp.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'ck_refresh=raw-token')
        .send({})
        .expect(401);

      await logoutApp.close();
    });

    it('returns 200 when refreshToken is empty (noop)', async () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: '' })
        .expect(200);
    });
  });

  // Regression guard: the global APP_GUARD JwtGuard makes every route
  // authenticated unless marked @Public(). These staff-auth routes carry no
  // access token (login/lookup) or authenticate via the ck_refresh cookie
  // (refresh/logout), so a missing @Public() returns 401 and breaks login.
  describe('@Public() metadata on tokenless auth routes', () => {
    const reflector = new Reflector();
    it.each(['loginEndpoint', 'lookupEndpoint', 'refreshEndpoint', 'logoutEndpoint'])(
      '%s is exempt from the global JwtGuard',
      (method) => {
        const handler = (AuthController.prototype as unknown as Record<string, () => unknown>)[method];
        expect(reflector.get(IS_PUBLIC_KEY, handler)).toBe(true);
      },
    );
  });
});
