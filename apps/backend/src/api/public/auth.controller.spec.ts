import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { AuthController } from './auth.controller';
import { LoginHandler } from '../../modules/identity/login/login.handler';
import { LogoutHandler } from '../../modules/identity/logout/logout.handler';
import { PrismaService } from '../../infrastructure/database';
import { TokenService } from '../../modules/identity/shared/token.service';
import { GetCurrentUserHandler } from '../../modules/identity/get-current-user/get-current-user.handler';
import { ChangePasswordHandler } from '../../modules/identity/users/change-password.handler';
import { ConfigService } from '@nestjs/config';
import { RequestPasswordResetHandler } from '../../modules/identity/user-password-reset/request-password-reset/request-password-reset.handler';
import { PerformPasswordResetHandler } from '../../modules/identity/user-password-reset/perform-password-reset/perform-password-reset.handler';
import { RequestDashboardOtpHandler } from '../../modules/identity/request-dashboard-otp/request-dashboard-otp.handler';
import { VerifyDashboardOtpHandler } from '../../modules/identity/verify-dashboard-otp/verify-dashboard-otp.handler';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { JwtGuard, IS_PUBLIC_KEY } from '../../common/guards/jwt.guard';
import { AuthResponseBuilder } from '../../modules/identity/shared/auth-response.builder';
import { LookupUserHandler } from '../../modules/identity/lookup-user/lookup-user.handler';

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
  const mockSettings = { get: jest.fn() };
  const mockAuthResponseBuilder = {
    build: jest.fn().mockImplementation((tokens, user) => ({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? '',
        phone: user.phone ?? null,
        gender: user.gender ?? null,
        avatarUrl: user.avatarUrl ?? null,
        isActive: user.isActive,
        role: user.role,
        isSuperAdmin: user.isSuperAdmin ?? false,
        firstName: (user.name ?? '').trim().split(/\s+/)[0] ?? '',
        lastName: (user.name ?? '').trim().split(/\s+/).slice(1).join(' ') ?? '',
        organizationId: '00000000-0000-0000-0000-000000000001',
        permissions: [],
      },
    })),
  };
  const mockLookupUser = { execute: jest.fn() };

  beforeAll(async () => {
    tokenHash = await bcrypt.hash('raw-token', 10);
  });

  const buildMockPrisma = () => ({
    refreshToken: {
      findMany: jest.fn(),
      update: jest.fn(),
      // P1: conditional updateMany prevents refresh-token reuse race.
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn(),
    },
  });

  const buildApp = async (mockPrisma: any, jwtGuardValue: any) => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginHandler, useValue: mockLogin },
        { provide: LogoutHandler, useValue: mockLogout },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: TokenService, useValue: mockTokens },
        { provide: GetCurrentUserHandler, useValue: mockGetCurrentUser },
        { provide: ChangePasswordHandler, useValue: mockChangePassword },
        { provide: ConfigService, useValue: mockConfig },
        { provide: RequestPasswordResetHandler, useValue: mockRequestPasswordReset },
        { provide: PerformPasswordResetHandler, useValue: mockPerformPasswordReset },
        { provide: RequestDashboardOtpHandler, useValue: mockRequestDashboardOtp },
        { provide: VerifyDashboardOtpHandler, useValue: mockVerifyDashboardOtp },
        { provide: PlatformSettingsService, useValue: mockSettings },
        { provide: AuthResponseBuilder, useValue: mockAuthResponseBuilder },
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
    it('returns 200 with tokens and user on valid login', async () => {
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
        if (key === 'ADMIN_HOSTS') return 'admin.example.com';
        if (key === 'JWT_ACCESS_TTL') return '15m';
        return defaultValue;
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123' })
        .expect(200);

      expect(res.body.accessToken).toBe('acc-token');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.headers['set-cookie']).toBeDefined();
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

  describe('POST /auth/refresh', () => {
    it('returns 200 with new access token', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          tokenHash,
          tokenSelector: 'raw-toke',
          userId: 'user-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, isSuperAdmin: false, customRole: null });
      mockTokens.issueTokenPair.mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });
      mockConfig.get.mockReturnValue('15m');

      const refreshApp = await buildApp(mockPrisma, { canActivate: () => true });

      const res = await request(refreshApp.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', 'ck_refresh=raw-token')
        .send({})
        .expect(200);

      expect(res.body.accessToken).toBe('new-acc');
      await refreshApp.close();
    });

    it('returns 401 when refreshToken cookie is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({})
        .expect(401);

      expect(res.body.message).toContain('No refresh token');
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
    it('returns 200 on valid logout', async () => {
      const mockPrisma = buildMockPrisma();
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          tokenHash,
          tokenSelector: 'raw-toke',
          userId: 'user-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockLogout.execute.mockResolvedValue(undefined);

      const logoutApp = await buildApp(mockPrisma, { canActivate: () => true });

      await request(logoutApp.getHttpServer())
        .post('/auth/logout')
        .send({ refreshToken: 'raw-token' })
        .expect(200);

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
