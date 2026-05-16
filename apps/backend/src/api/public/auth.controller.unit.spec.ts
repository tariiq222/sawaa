import { UnauthorizedException } from '@nestjs/common';
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { AuthController } from './auth.controller';

describe('AuthController (unit)', () => {
  let controller: AuthController;
  let mockLogin: any;
  let mockLogout: any;
  let mockPrisma: any;
  let mockTokens: any;
  let mockGetCurrentUser: any;
  let mockChangePassword: any;
  let mockConfig: any;
  let mockRequestPasswordReset: any;
  let mockPerformPasswordReset: any;
  let mockRequestDashboardOtp: any;
  let mockVerifyDashboardOtp: any;
  let mockSettings: any;
  let mockAuthResponseBuilder: any;
  let mockLookupUser: any;

  beforeEach(() => {
    mockLogin = { execute: jest.fn() };
    mockLogout = { execute: jest.fn() };
    mockPrisma = {
      refreshToken: { findMany: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    mockTokens = { issueTokenPair: jest.fn() };
    mockGetCurrentUser = { execute: jest.fn() };
    mockChangePassword = { execute: jest.fn() };
    mockConfig = { get: jest.fn(), getOrThrow: jest.fn() };
    mockRequestPasswordReset = { execute: jest.fn() };
    mockPerformPasswordReset = { execute: jest.fn() };
    mockRequestDashboardOtp = { execute: jest.fn() };
    mockVerifyDashboardOtp = { execute: jest.fn() };
    mockSettings = { get: jest.fn() };
    mockAuthResponseBuilder = {
      build: jest.fn().mockImplementation((_tokens: any, user: any) => ({
        accessToken: _tokens.accessToken,
        refreshToken: _tokens.refreshToken,
        expiresIn: 900,
        user: {
          ...user,
          firstName: (user.name ?? '').trim().split(/\s+/)[0] ?? '',
          lastName: (user.name ?? '').trim().split(/\s+/).slice(1).join(' '),
          organizationId: null,
          permissions: [],
        },
      })),
    };
    mockLookupUser = { execute: jest.fn() };

    controller = new AuthController(
      mockLogin,
      mockLogout,
      mockPrisma,
      mockTokens,
      mockGetCurrentUser,
      mockChangePassword,
      mockConfig,
      mockRequestPasswordReset,
      mockPerformPasswordReset,
      mockRequestDashboardOtp,
      mockVerifyDashboardOtp,
      mockSettings,
      mockAuthResponseBuilder,
      mockLookupUser,
    );
  });

  const mockRes = () => {
    const res: Partial<Response> = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    return res as Response;
  };

  describe('loginEndpoint', () => {
    it('should require OTP for superAdmin when 2FA enabled', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', email: 'a@b.com', name: 'Admin', isActive: true, role: 'ADMIN', isSuperAdmin: true, customRole: null },
      });
      mockSettings.get.mockResolvedValue(true);
      mockConfig.get.mockReturnValue('15m');

      const res = mockRes();
      const result = await controller.loginEndpoint({ email: 'a@b.com', password: 'p' } as any, '127.0.0.1', res);
      expect(result).toEqual({ requiresOtp: true });
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('should skip 2FA for non-superAdmin even when required', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', email: 'a@b.com', name: 'User', isActive: true, role: 'ADMIN', isSuperAdmin: false, customRole: null },
      });
      mockSettings.get.mockResolvedValue(true);
      mockConfig.get.mockReturnValue('15m');

      const res = mockRes();
      const result = await controller.loginEndpoint({ email: 'a@b.com', password: 'p' } as any, '127.0.0.1', res);
      expect(result).toHaveProperty('accessToken');
    });

    it('should return user with null when no user object', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: null,
      });
      mockConfig.get.mockReturnValue('15m');

      const res = mockRes();
      const result = await controller.loginEndpoint({ email: 'a@b.com', password: 'p' } as any, '127.0.0.1', res);
      expect((result as any).user).toBeNull();
    });

    it('should split name into firstName and lastName', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', email: 'a@b.com', name: 'John Jacob Doe', isActive: true, role: 'ADMIN', isSuperAdmin: false, customRole: null },
      });
      mockConfig.get.mockReturnValue('15m');

      const res = mockRes();
      const result = await controller.loginEndpoint({ email: 'a@b.com', password: 'p' } as any, '127.0.0.1', res);
      expect((result as any).user.firstName).toBe('John');
      expect((result as any).user.lastName).toBe('Jacob Doe');
    });

    it('should handle empty name', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        user: { id: 'u1', email: 'a@b.com', name: '', isActive: true, role: 'ADMIN', isSuperAdmin: false, customRole: null },
      });
      mockConfig.get.mockReturnValue('15m');

      const res = mockRes();
      const result = await controller.loginEndpoint({ email: 'a@b.com', password: 'p' } as any, '127.0.0.1', res);
      expect((result as any).user.firstName).toBe('');
      expect((result as any).user.lastName).toBe('');
    });
  });

  describe('refreshEndpoint', () => {
    it('should use cookie token when present', async () => {
      const req = { cookies: { ck_refresh: 'cookie-token' } } as any;
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);
      mockConfig.get.mockReturnValue('15m');

      await expect(controller.refreshEndpoint({ refreshToken: 'body-token' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tokenSelector: 'cookie-t' }),
      }));
    });

    it('should use body token when no cookie', async () => {
      const req = { cookies: {} } as any;
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);
      mockConfig.get.mockReturnValue('15m');

      await expect(controller.refreshEndpoint({ refreshToken: 'body-token' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
      expect(mockPrisma.refreshToken.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tokenSelector: 'body-tok' }),
      }));
    });

    it('should throw when no token at all', async () => {
      const req = { cookies: {} } as any;
      await expect(controller.refreshEndpoint({ refreshToken: '' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user inactive', async () => {
      const req = { cookies: { ck_refresh: 'raw-token' } } as any;
      const tokenHash = await bcrypt.hash('raw-token', 10);
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt1', tokenHash, tokenSelector: 'raw-toke', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 86400000) },
      ]);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
      mockConfig.get.mockReturnValue('15m');

      await expect(controller.refreshEndpoint({ refreshToken: '' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user not found', async () => {
      const req = { cookies: { ck_refresh: 'raw-token' } } as any;
      const tokenHash = await bcrypt.hash('raw-token', 10);
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt1', tokenHash, tokenSelector: 'raw-toke', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 86400000) },
      ]);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockConfig.get.mockReturnValue('15m');

      await expect(controller.refreshEndpoint({ refreshToken: '' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logoutEndpoint', () => {
    it('should return early when no token', async () => {
      const req = { cookies: {} } as any;
      const res = mockRes();
      mockLogout.execute.mockResolvedValue(undefined);

      await controller.logoutEndpoint({ refreshToken: '' } as any, req, res);
      expect(mockLogout.execute).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('ck_refresh', { path: '/' });
    });
  });

  describe('parseTtlSeconds', () => {
    it('should parse seconds', async () => {
      mockConfig.get.mockReturnValue('30s');
      mockConfig.getOrThrow.mockReturnValue('30s');
      const res = mockRes();
      mockLogin.execute.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: null });
      await controller.loginEndpoint({ rememberMe: true } as any, '', res);
      expect(res.cookie).toHaveBeenCalledWith('ck_refresh', 'rt', expect.objectContaining({ maxAge: 30_000 }));
    });

    it('should parse minutes', async () => {
      mockConfig.get.mockReturnValue('15m');
      const res = mockRes();
      mockLogin.execute.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: null });
      await controller.loginEndpoint({} as any, '', res);
    });

    it('should parse hours', async () => {
      mockConfig.get.mockReturnValue('2h');
      const res = mockRes();
      mockLogin.execute.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: null });
      await controller.loginEndpoint({} as any, '', res);
    });

    it('should parse days', async () => {
      mockConfig.get.mockReturnValue('7d');
      const res = mockRes();
      mockLogin.execute.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: null });
      await controller.loginEndpoint({} as any, '', res);
    });

    it('should default to 900 on invalid format', async () => {
      mockConfig.get.mockReturnValue('invalid');
      const res = mockRes();
      mockLogin.execute.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', user: null });
      await controller.loginEndpoint({} as any, '', res);
    });
  });

  describe('findActiveToken', () => {
    it('should throw when no candidates match', async () => {
      mockPrisma.refreshToken.findMany.mockResolvedValue([]);
      const req = { cookies: { ck_refresh: 'token' } } as any;
      await expect(controller.refreshEndpoint({ refreshToken: '' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when bcrypt compare fails for all candidates', async () => {
      const tokenHash = await bcrypt.hash('different-token', 10);
      mockPrisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt1', tokenHash, tokenSelector: 'raw-toke', userId: 'u1', revokedAt: null, expiresAt: new Date(Date.now() + 86400000) },
      ]);
      const req = { cookies: { ck_refresh: 'raw-token' } } as any;
      await expect(controller.refreshEndpoint({ refreshToken: '' } as any, req, mockRes())).rejects.toThrow(UnauthorizedException);
    });
  });
});
