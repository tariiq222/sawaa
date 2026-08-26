import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { CaslAbilityFactory } from './casl/casl-ability.factory';
import { loadSystemRolePermissions } from './shared/load-system-role-permissions';

jest.mock('./shared/load-system-role-permissions', () => ({
  loadSystemRolePermissions: jest.fn(),
}));

const buildPrisma = () => ({
  user: {
    findUnique: jest.fn(),
  },
  customRole: {
    // Default: loader is mocked, so customRole.findFirst is unused, but kept
    // for any code path that bypasses the loader (none today).
    findFirst: jest.fn().mockResolvedValue(null),
  },
});

const buildCasl = () => ({
  buildForUser: jest.fn().mockReturnValue({
    rules: [{ action: 'manage', subject: 'all' }],
  }),
});

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: ReturnType<typeof buildPrisma>;
  let casl: ReturnType<typeof buildCasl>;
  let cls: { run: jest.Mock; set: jest.Mock };
  const loaderMock = loadSystemRolePermissions as jest.MockedFunction<
    typeof loadSystemRolePermissions
  >;

  beforeEach(() => {
    prisma = buildPrisma();
    casl = buildCasl();
    cls = { run: jest.fn((fn) => fn()), set: jest.fn() };
    loaderMock.mockReset();
    strategy = new JwtStrategy(
      { getOrThrow: () => 'secret' } as any,
      prisma as any,
      casl as any,
      cls as any,
    );
  });

  it('validate returns user with permissions', async () => {
    const user = {
      id: 'u1',
      email: 'test@example.com',
      role: 'OWNER',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: true,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue(null);

    const result = await strategy.validate({
      sub: 'u1',
      email: 'test@example.com',
      role: 'OWNER',
      customRoleId: null,
      permissions: [],
      features: ['feat1'],
      tokenVersion: 1,
      scope: 'dashboard',
    } as any);

    expect(result.id).toBe('u1');
    expect(result.isSuperAdmin).toBe(true);
    expect(result.features).toEqual(['feat1']);
    expect(result.scope).toBe('dashboard');
  });

  it('validate throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'u1' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('validate throws when user is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false });
    await expect(
      strategy.validate({ sub: 'u1' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('validate rejects CLIENT role tokens (P0-1)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      role: 'CLIENT',
      customRoleId: null,
      customRole: null,
      isSuperAdmin: false,
      tokenVersion: 0,
    });
    await expect(
      strategy.validate({ sub: 'u1' } as any),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('validate throws when tokenVersion mismatches', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      tokenVersion: 2,
    });
    await expect(
      strategy.validate({ sub: 'u1', tokenVersion: 1 } as any),
    ).rejects.toThrow('Session has been revoked');
  });

  it('validate passes when tokenVersion undefined in payload', async () => {
    const user = {
      id: 'u1',
      email: 'test@example.com',
      role: 'OWNER',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 2,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue(null);

    const result = await strategy.validate({
      sub: 'u1',
      email: 'test@example.com',
      role: 'OWNER',
      customRoleId: null,
      permissions: [],
      features: [],
    } as any);

    expect(result.id).toBe('u1');
  });

  it('validate handles array actions in permissions', async () => {
    casl.buildForUser.mockReturnValue({
      rules: [{ action: ['read', 'update'], subject: 'Booking' }],
    });
    const user = {
      id: 'u1',
      email: 'test@example.com',
      role: 'RECEPTIONIST',
      customRoleId: 'cr1',
      customRole: { permissions: [{ action: 'read', subject: 'Booking' }] },
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue([{ action: 'read', subject: 'Booking' }]);

    const result = await strategy.validate({
      sub: 'u1',
      tokenVersion: 1,
    } as any);

    expect(result.permissions).toEqual([
      { action: 'read', subject: 'Booking' },
      { action: 'update', subject: 'Booking' },
    ]);
    expect(result.customRole).toEqual(user.customRole);
  });

  it('validate defaults features to empty array', async () => {
    const user = {
      id: 'u1',
      email: 'test@example.com',
      role: 'OWNER',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue(null);

    const result = await strategy.validate({ sub: 'u1', tokenVersion: 1 } as any);
    expect(result.features).toEqual([]);
  });

  // ──────────────── RX-PERMS-EMPTY regression coverage ────────────────

  it('routes through loadSystemRolePermissions (does NOT run its own DB query)', async () => {
    const user = {
      id: 'u1',
      email: 'r@sawaa-test.com',
      role: 'RECEPTIONIST',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue([
      { action: 'create', subject: 'Payment' },
      { action: 'create', subject: 'Invoice' },
    ]);

    await strategy.validate({ sub: 'u1', tokenVersion: 1 } as any);

    expect(loaderMock).toHaveBeenCalledTimes(1);
    expect(loaderMock).toHaveBeenCalledWith(prisma, 'RECEPTIONIST');
    expect((prisma as any).customRole.findFirst).not.toHaveBeenCalled();
  });

  it('passes null (not []) into buildForUser when loader returns null', async () => {
    // RX-PERMS-EMPTY: zero-row uncustomized role must NOT be reported as a
    // deny-all grant. The factory treats `null` as BUILT_IN fallback and
    // produces non-empty ability.rules for RECEPTIONIST.
    const user = {
      id: 'u1',
      email: 'r@sawaa-test.com',
      role: 'RECEPTIONIST',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue(null);
    casl.buildForUser.mockReturnValue({
      rules: [{ action: 'create', subject: 'Payment' }],
    });

    await strategy.validate({ sub: 'u1', tokenVersion: 1 } as any);

    expect(casl.buildForUser).toHaveBeenCalledWith(
      expect.objectContaining({ systemRolePermissions: null }),
    );
  });

  it('passes [] into buildForUser when loader returns [] (customized empty)', async () => {
    // The deny-all path must remain intact for admin-deliberate empty edits.
    const user = {
      id: 'u1',
      email: 'admin@sawaa-test.com',
      role: 'ADMIN',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue([]);

    await strategy.validate({ sub: 'u1', tokenVersion: 1 } as any);

    expect(casl.buildForUser).toHaveBeenCalledWith(
      expect.objectContaining({ systemRolePermissions: [] }),
    );
  });

  it('passes the loader DB list into buildForUser when loader returns rows', async () => {
    const user = {
      id: 'u1',
      email: 'r@sawaa-test.com',
      role: 'RECEPTIONIST',
      customRoleId: null,
      customRole: null,
      isActive: true,
      isSuperAdmin: false,
      tokenVersion: 1,
    };
    prisma.user.findUnique.mockResolvedValue(user);
    loaderMock.mockResolvedValue([
      { action: 'create', subject: 'Payment' },
      { action: 'create', subject: 'Invoice' },
    ]);

    await strategy.validate({ sub: 'u1', tokenVersion: 1 } as any);

    expect(casl.buildForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        systemRolePermissions: [
          { action: 'create', subject: 'Payment' },
          { action: 'create', subject: 'Invoice' },
        ],
      }),
    );
  });

  it('skips the loader when the user is not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      strategy.validate({ sub: 'u1' } as any),
    ).rejects.toThrow(UnauthorizedException);
    expect(loaderMock).not.toHaveBeenCalled();
  });
});
