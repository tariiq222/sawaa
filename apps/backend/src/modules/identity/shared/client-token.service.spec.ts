import { ClientTokenService } from './client-token.service';

const mockClient = { id: 'client-1', email: 'walk-in@clinic.sa', emailVerified: null };

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
    const pair = await svc.issueTokenPair(mockClient, { channel: 'web' });

    expect(pair.accessToken).toBe('signed.access.token');
    expect(typeof pair.rawRefresh).toBe('string');
    expect(pair.rawRefresh.length).toBeGreaterThan(10);
    expect(pair.accessMaxAgeMs).toBeGreaterThan(0);
    expect(pair.refreshMaxAgeMs).toBeGreaterThan(0);
  });

  it('signs JWT without legacy organizationId claim', async () => {
    const jwt = buildJwt();
    const svc = new ClientTokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await svc.issueTokenPair(mockClient, { channel: 'web' });

    expect(jwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: 'client-1',
        namespace: 'client',
      }),
      expect.objectContaining({ secret: 'client-access-secret' }),
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      expect.not.objectContaining({ organizationId: expect.anything() }),
      expect.anything(),
    );
  });

  it.each(['web', 'mobile'] as const)('stamps the %s channel claim into the signed payload', async (channel) => {
    const jwt = buildJwt();
    const svc = new ClientTokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await svc.issueTokenPair(mockClient, { channel });
    expect(jwt.sign.mock.calls[0][0]).toMatchObject({ channel });
  });

  it('puts only a verified email in the token claim', async () => {
    const jwt = buildJwt();
    const svc = new ClientTokenService(jwt as never, buildConfig() as never, buildPrisma() as never);
    await svc.issueTokenPair(mockClient, { channel: 'web' });
    expect(jwt.sign.mock.calls[0][0]).toMatchObject({ email: '' });
    await svc.issueTokenPair({ ...mockClient, emailVerified: new Date() }, { channel: 'web' });
    expect(jwt.sign.mock.calls[1][0]).toMatchObject({ email: 'walk-in@clinic.sa' });
  });

  it('persists refresh token row keyed by clientId only', async () => {
    const prisma = buildPrisma();
    const svc = new ClientTokenService(buildJwt() as never, buildConfig() as never, prisma as never);
    await svc.issueTokenPair(mockClient, { channel: 'web' });

    expect(prisma.clientRefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          // org scoping moved to RLS / removed in single-tenant migration
        }),
      }),
    );
  });
});
