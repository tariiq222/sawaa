import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
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
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { RequestDashboardOtpHandler } from '../../modules/identity/request-dashboard-otp/request-dashboard-otp.handler';
import { VerifyDashboardOtpHandler } from '../../modules/identity/verify-dashboard-otp/verify-dashboard-otp.handler';
import { ClsService } from 'nestjs-cls';
import { PlatformSettingsService } from '../../modules/platform/settings/platform-settings.service';
import { JwtGuard } from '../../common/guards/jwt.guard';

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
  const mockTenant = { requireOrganizationIdOrDefault: jest.fn().mockReturnValue('00000000-0000-0000-0000-000000000001') };
  const mockRequestDashboardOtp = { execute: jest.fn() };
  const mockVerifyDashboardOtp = { execute: jest.fn() };
  const mockCls = { run: jest.fn().mockImplementation((fn) => fn()), set: jest.fn() };
  const mockSettings = { get: jest.fn() };

  beforeAll(async () => {
    tokenHash = await bcrypt.hash('raw-token', 10);
  });

  const buildMockPrisma = () => ({
    $allTenants: {
      refreshToken: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    },
    refreshToken: {
      findMany: jest.fn(),
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
        { provide: TenantContextService, useValue: mockTenant },
        { provide: RequestDashboardOtpHandler, useValue: mockRequestDashboardOtp },
        { provide: VerifyDashboardOtpHandler, useValue: mockVerifyDashboardOtp },
        { provide: ClsService, useValue: mockCls },
        { provide: PlatformSettingsService, useValue: mockSettings },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue(jwtGuardValue)
      .compile();

    const nestApp = moduleRef.createNestApplication();
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
      mockPrisma.$allTenants.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          tokenHash,
          tokenSelector: 'raw-toke',
          userId: 'user-1',
          organizationId: '00000000-0000-0000-0000-000000000001',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
        },
      ]);
      mockPrisma.$allTenants.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', isActive: true, isSuperAdmin: false, customRole: null });
      mockTokens.issueTokenPair.mockResolvedValue({ accessToken: 'new-acc', refreshToken: 'new-ref' });
      mockConfig.get.mockReturnValue('15m');

      const refreshApp = await buildApp(mockPrisma, { canActivate: () => true });

      const res = await request(refreshApp.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'raw-token' })
        .expect(200);

      expect(res.body.accessToken).toBe('new-acc');
      await refreshApp.close();
    });

    it('returns 401 when refreshToken is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: '' })
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
      mockPrisma.$allTenants.refreshToken.findMany.mockResolvedValue([
        {
          id: 'rt-1',
          tokenHash,
          tokenSelector: 'raw-toke',
          userId: 'user-1',
          organizationId: '00000000-0000-0000-0000-000000000001',
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
});
