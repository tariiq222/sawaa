import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { CaslAbilityFactory } from './casl/casl-ability.factory';

const buildPrisma = () => ({
  user: {
    findUnique: jest.fn(),
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

  beforeEach(() => {
    prisma = buildPrisma();
    casl = buildCasl();
    cls = { run: jest.fn((fn) => fn()), set: jest.fn() };
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

    const result = await strategy.validate({ sub: 'u1', tokenVersion: 1 } as any);
    expect(result.features).toEqual([]);
  });
});
