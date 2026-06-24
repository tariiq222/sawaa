import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { AssignPermissionsHandler } from './assign-permissions.handler';

describe('AssignPermissionsHandler', () => {
  let handler: AssignPermissionsHandler;
  let prisma: {
    customRole: { findFirst: jest.Mock; update: jest.Mock };
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
            customRole: {
              findFirst: jest.fn(),
              update: jest.fn().mockResolvedValue({ id: 'role' }),
            },
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

  // ── Custom-role path (unchanged behavior) ──────────────────────────────────

  it('assigns permissions and bumps tokenVersion for custom-role users', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: false, systemKey: null });

    await handler.execute({ customRoleId: 'role', permissions: [{ action: 'read', subject: 'User' }] });

    // The atomic replace ran with exactly the new permission set.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({ where: { customRoleId: 'role' } });
    expect(prisma.permission.createMany).toHaveBeenCalledWith({
      data: [{ customRoleId: 'role', action: 'read', subject: 'User' }],
    });
    // Custom roles are NOT touched by the bootstrap, so permissionsCustomized stays untouched.
    expect(prisma.customRole.update).not.toHaveBeenCalled();
    // Session invalidation targets users by customRoleId for custom roles.
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { customRoleId: 'role' },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  // ── System-role path (NEW behavior: now editable + persisted) ──────────────

  it('persists an edit to a SYSTEM role (transaction writes the new permission set)', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: true, systemKey: 'ADMIN' });

    await handler.execute({
      customRoleId: 'role',
      permissions: [{ action: 'read', subject: 'Booking' }],
    });

    // Previously this path threw ForbiddenException and never wrote — now it persists.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.permission.deleteMany).toHaveBeenCalledWith({ where: { customRoleId: 'role' } });
    expect(prisma.permission.createMany).toHaveBeenCalledWith({
      data: [{ customRoleId: 'role', action: 'read', subject: 'Booking' }],
    });
  });

  it('flips permissionsCustomized=true for a SYSTEM role inside the same transaction', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: true, systemKey: 'ADMIN' });

    await handler.execute({
      customRoleId: 'role',
      permissions: [{ action: 'read', subject: 'Booking' }],
    });

    expect(prisma.customRole.update).toHaveBeenCalledWith({
      where: { id: 'role' },
      data: { permissionsCustomized: true },
    });
    // The update is part of the same atomic $transaction batch (3 ops), not a separate call.
    const txArgs = prisma.$transaction.mock.calls[0][0];
    expect(Array.isArray(txArgs)).toBe(true);
    expect(txArgs).toHaveLength(3);
  });

  it('bumps tokenVersion for all users holding the built-in role when a SYSTEM role is edited', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: true, systemKey: 'ADMIN' });

    await handler.execute({
      customRoleId: 'role',
      permissions: [{ action: 'read', subject: 'Booking' }],
    });

    // System-role invalidation targets users by their built-in `role`, not customRoleId.
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { role: 'ADMIN' },
      data: { tokenVersion: { increment: 1 } },
    });
  });

  // ── Privilege-escalation guard ─────────────────────────────────────────────

  it('rejects a payload that grants subject:all (god-mode) with BadRequestException', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: true, systemKey: 'ADMIN' });

    await expect(
      handler.execute({
        customRoleId: 'role',
        permissions: [{ action: 'manage', subject: 'all' }],
      }),
    ).rejects.toThrow(BadRequestException);

    // Nothing is written and no session is invalidated when the guard rejects.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.customRole.update).not.toHaveBeenCalled();
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('rejects subject:all regardless of action (case-insensitive)', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: false, systemKey: null });

    await expect(
      handler.execute({
        customRoleId: 'role',
        permissions: [
          { action: 'read', subject: 'Booking' },
          { action: 'READ', subject: 'ALL' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // ── Not-found ──────────────────────────────────────────────────────────────

  it('throws NotFoundException when the role does not exist', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'role', permissions: [] })).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
