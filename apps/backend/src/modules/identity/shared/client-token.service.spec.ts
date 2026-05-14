import { ClientTokenService } from './client-token.service';

const mockClient = { id: 'client-1', email: 'walk-in@clinic.sa' };

const tenantClaims = { organizationId: 'org-1' };

const buildJwt = () => ({
  sign: jest.fn().mockReturnValue('signed.access.token'),
});

const buildConfig = (overrides: Record<string, string> = {}) => ({
  getOrThrow: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      JWT_CLIENT_ACCESS_SECRET: 'client-access-secret',
      ...overrides,
    };
    return map[key];
  }),
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      JWT_CLIENT_ACCESS_TTL: '15m',
      JWT_CLIENT_REFRESH_TTL: '7d',
      ...overrides,
    };
    return map[key];
  }),
});

const buildPrisma = () => ({
  clientRefreshToken: {
    create: jest.fn().mockResolvedValue({ id: 'crt-1' }),
  },
});

describe('ClientTokenService.issueTokenPair', () => {
  it('returns accessToken + rawRefresh + TTL metadata', async () => {
    const svc = new ClientTokenService(buildJwt() as never, buildConfig() as never, buildPrisma() as never);
    const pair = await svc.issueTokenPair(mockClient, tenantClaims);

    expect(pair.accessToken).toBe('signed.access.token');
    expect(typeof pair.rawRefresh).toBe('string');
    expect(pair.rawRefresh.length).toBeGreaterThan(10);
    expect(pair.accessMaxAgeMs).toBeGreaterThan(0);
    expect(pair.refreshMaxAgeMs).toBeGreaterThan(0);
  });

  it('signs JWT with organizationId claim', async () => {
    const jwt = buildJwt();
    const svc = new ClientTokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await svc.issueTokenPair(mockClient, { organizationId: 'org-2' });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'client-1',
        namespace: 'client',
        organizationId: 'org-2',
      }),
      expect.objectContaining({ secret: 'client-access-secret' }),
    );
  });

  it('persists organizationId on ClientRefreshToken', async () => {
    const prisma = buildPrisma();
    const svc = new ClientTokenService(buildJwt() as never, buildConfig() as never, prisma as never);
    await svc.issueTokenPair(mockClient, { organizationId: 'org-1' });

    expect(prisma.clientRefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          organizationId: 'org-1',
        }),
      }),
    );
  });
});
