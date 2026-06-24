import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { SystemRolesBootstrap } from './system-roles.bootstrap';

describe('SystemRolesBootstrap', () => {
  let bootstrap: SystemRolesBootstrap;
  let prisma: {
    customRole: { findFirst: jest.Mock; create: jest.Mock };
    permission: { deleteMany: jest.Mock; createMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemRolesBootstrap,
        {
          provide: PrismaService,
          useValue: {
            customRole: { findFirst: jest.fn(), create: jest.fn() },
            permission: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              createMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
            $transaction: jest.fn(async (ops: any[]) => {
              for (const op of ops) await op;
            }),
          },
        },
      ],
    }).compile();

    bootstrap = module.get<SystemRolesBootstrap>(SystemRolesBootstrap);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('should create system roles when none exist', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    await bootstrap.onModuleInit();
    // ADMIN, RECEPTIONIST, ACCOUNTANT, EMPLOYEE = 4 roles
    expect(prisma.customRole.create).toHaveBeenCalledTimes(4);
  });

  it('syncs permissions when a system role exists and is NOT customized', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'existing-id', permissionsCustomized: false });
    await bootstrap.onModuleInit();
    // One sync transaction per existing, non-customized role.
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
    expect(prisma.customRole.create).not.toHaveBeenCalled();
  });

  it('SKIPS the sync (no delete/recreate) when a system role is customized', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'existing-id', permissionsCustomized: true });
    await bootstrap.onModuleInit();
    // The customized branch must not touch permissions at all.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.permission.deleteMany).not.toHaveBeenCalled();
    expect(prisma.permission.createMany).not.toHaveBeenCalled();
    expect(prisma.customRole.create).not.toHaveBeenCalled();
  });

  it('REGRESSION: a customized system role survives a bootstrap run (admin edit is not wiped)', async () => {
    // Simulate the exact bug scenario: an admin previously edited ADMIN's
    // permissions (permissionsCustomized=true) and the other three roles are
    // untouched defaults. Before the fix, EVERY existing role was deleteMany +
    // createMany on boot, destroying the admin edit. After the fix, the
    // customized role must be left completely alone while the others still sync.
    prisma.customRole.findFirst.mockImplementation(({ where }: { where: { systemKey: string } }) => {
      if (where.systemKey === 'ADMIN') {
        return Promise.resolve({ id: 'admin-id', permissionsCustomized: true });
      }
      return Promise.resolve({ id: `${where.systemKey}-id`, permissionsCustomized: false });
    });

    await bootstrap.onModuleInit();

    // The customized ADMIN role's permission rows were never deleted/recreated.
    const deletedRoleIds = prisma.permission.deleteMany.mock.calls.map(
      (c) => c[0].where.customRoleId,
    );
    expect(deletedRoleIds).not.toContain('admin-id');
    // The other three (non-customized) roles still got synced from BUILT_IN.
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
    expect(deletedRoleIds.sort()).toEqual(
      ['ACCOUNTANT-id', 'EMPLOYEE-id', 'RECEPTIONIST-id'],
    );
  });

  it('should be idempotent across two runs (create-then-sync)', async () => {
    // First run: roles don't exist → create
    prisma.customRole.findFirst.mockResolvedValue(null);
    await bootstrap.onModuleInit();
    expect(prisma.customRole.create).toHaveBeenCalledTimes(4);

    // Second run: roles exist and are not customized → sync
    jest.clearAllMocks();
    prisma.customRole.findFirst.mockResolvedValue({ id: 'existing-id', permissionsCustomized: false });
    await bootstrap.onModuleInit();
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
    expect(prisma.customRole.create).not.toHaveBeenCalled();
  });
});
