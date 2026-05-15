import { TokenService, TenantClaims } from './token.service';

const buildJwt = () => ({
  sign: jest.fn().mockReturnValue('signed.access.token'),
});

const buildConfig = (overrides: Record<string, string> = {}) => ({
  getOrThrow: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_SECRET: 'access-secret',
      ...overrides,
    };
    return map[key];
  }),
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string | undefined> = {
      JWT_ACCESS_TTL: '15m',
      JWT_REFRESH_TTL: '30d',
      ...overrides,
    };
    return map[key];
  }),
});

const buildPrisma = () => ({
  refreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
  },
});

describe('TokenService', () => {
  describe('issueTokenPair', () => {
    it('creates accessToken with correct payload', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        customRoleId: null,
        customRole: null,
        tokenVersion: 1,
      };
      const tenantClaims: TenantClaims = { organizationId: 'org-1' };

      await svc.issueTokenPair(user, tenantClaims);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-1',
          email: 'user@example.com',
          role: 'ADMIN',
        }),
        expect.anything(),
      );
    });

    it('creates refreshToken and stores hash in DB', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        customRoleId: null,
        customRole: null,
        tokenVersion: 1,
      };
      const tenantClaims: TenantClaims = { organizationId: 'org-1' };

      const result = await svc.issueTokenPair(user, tenantClaims);

      expect(typeof result.refreshToken).toBe('string');
      expect(result.refreshToken.length).toBeGreaterThan(10);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tokenHash: expect.any(String),
            tokenSelector: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });

    it('uses JWT_ACCESS_SECRET and JWT_ACCESS_TTL', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        customRoleId: null,
        customRole: null,
        tokenVersion: 1,
      };
      const tenantClaims: TenantClaims = { organizationId: 'org-1' };

      await svc.issueTokenPair(user, tenantClaims);

      expect(config.getOrThrow).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
      expect(config.get).toHaveBeenCalledWith('JWT_ACCESS_TTL');
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          secret: 'access-secret',
          expiresIn: '15m',
        }),
      );
    });

    it('uses JWT_REFRESH_TTL config', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        customRoleId: null,
        customRole: null,
        tokenVersion: 1,
      };
      const tenantClaims: TenantClaims = { organizationId: 'org-1' };

      await svc.issueTokenPair(user, tenantClaims);

      expect(config.get).toHaveBeenCalledWith('JWT_REFRESH_TTL');
    });

    it('payload includes all tenantClaims fields', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        customRoleId: null,
        customRole: null,
        tokenVersion: 2,
      };
      const tenantClaims: TenantClaims = {
        organizationId: 'org-1',
        isSuperAdmin: true,
        scope: 'read:all',
      };

      await svc.issueTokenPair(user, tenantClaims);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-1',
          isSuperAdmin: true,
          scope: 'read:all',
        }),
        expect.anything(),
      );
    });

    it('payload includes permissions from customRole', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'CUSTOM',
        customRoleId: 'role-1',
        customRole: {
          permissions: [{ action: 'manage', subject: 'bookings' }],
        },
        tokenVersion: 1,
      };
      const tenantClaims: TenantClaims = { organizationId: 'org-1' };

      await svc.issueTokenPair(user, tenantClaims);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: [{ action: 'manage', subject: 'bookings' }],
        }),
        expect.anything(),
      );
    });

    it('payload has empty permissions when no customRole', async () => {
      const jwt = buildJwt();
      const config = buildConfig();
      const prisma = buildPrisma();
      const svc = new TokenService(jwt as never, config as never, prisma as never);

      const user = {
        id: 'user-1',
        email: 'user@example.com',
        role: 'ADMIN',
        customRoleId: null,
        customRole: null,
        tokenVersion: 1,
      };
      const tenantClaims: TenantClaims = { organizationId: 'org-1' };

      await svc.issueTokenPair(user, tenantClaims);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          permissions: [],
        }),
        expect.anything(),
      );
    });
  });

  describe('parseTtlMs', () => {
    it('handles s, m, h, d', () => {
      const svc = new TokenService(buildJwt() as never, buildConfig() as never, buildPrisma() as never);

      expect((svc as any).parseTtlMs('30s')).toBe(30000);
      expect((svc as any).parseTtlMs('15m')).toBe(900000);
      expect((svc as any).parseTtlMs('24h')).toBe(86400000);
      expect((svc as any).parseTtlMs('7d')).toBe(604800000);
    });

    it('returns default for invalid format', () => {
      const svc = new TokenService(buildJwt() as never, buildConfig() as never, buildPrisma() as never);

      expect((svc as any).parseTtlMs('invalid')).toBe(30 * 24 * 60 * 60 * 1000);
      expect((svc as any).parseTtlMs('')).toBe(30 * 24 * 60 * 60 * 1000);
      expect((svc as any).parseTtlMs('10x')).toBe(30 * 24 * 60 * 60 * 1000);
    });
  });
});
