import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsHandler } from './assign-permissions.handler';

describe('AssignPermissionsHandler', () => {
  let handler: AssignPermissionsHandler;
  let prisma: {
    customRole: { findFirst: jest.Mock };
    permission: { deleteMany: jest.Mock; createMany: jest.Mock };
    user: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    const mockTransaction = jest.fn(async (ops: any[]) => {
      for (const op of ops) await op;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssignPermissionsHandler,
        {
          provide: PrismaService,
          useValue: {
            customRole: { findFirst: jest.fn() },
            permission: {
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
              createMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
            $transaction: mockTransaction,
          },
        },
      ],
    }).compile();

    handler = module.get<AssignPermissionsHandler>(AssignPermissionsHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should assign permissions and bump tokenVersion for custom role users', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: false, systemKey: null });
    await handler.execute({ customRoleId: 'role', permissions: [{ action: 'read', subject: 'User' }] });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { customRoleId: 'role' },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('should bump tokenVersion by UserRole for system role', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: true, systemKey: 'ADMIN' });
    await handler.execute({ customRoleId: 'role', permissions: [{ action: 'read', subject: 'User' }] });
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  it('should throw NotFoundException when role not found', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'role', permissions: [] })).rejects.toThrow(NotFoundException);
  });
});
