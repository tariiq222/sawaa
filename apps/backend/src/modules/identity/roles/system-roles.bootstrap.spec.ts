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

  it('should sync permissions when system roles already exist (idempotent)', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'existing-id' });
    await bootstrap.onModuleInit();
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
    expect(prisma.customRole.create).not.toHaveBeenCalled();
  });

  it('should be idempotent across two runs (create-then-sync)', async () => {
    // First run: roles don't exist → create
    prisma.customRole.findFirst.mockResolvedValue(null);
    await bootstrap.onModuleInit();
    expect(prisma.customRole.create).toHaveBeenCalledTimes(4);

    // Second run: roles exist → sync
    jest.clearAllMocks();
    prisma.customRole.findFirst.mockResolvedValue({ id: 'existing-id' });
    await bootstrap.onModuleInit();
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
    expect(prisma.customRole.create).not.toHaveBeenCalled();
  });
});
