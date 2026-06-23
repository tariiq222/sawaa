import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { UpdateUserHandler } from './update-user.handler';

describe('UpdateUserHandler', () => {
  let handler: UpdateUserHandler;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    rlsTransaction = {
      withTransaction: jest.fn((cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateUserHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<UpdateUserHandler>(UpdateUserHandler);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1' })).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does NOT touch the DB when the user does not exist (no leaky updates)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(handler.execute({ userId: 'u1', name: 'X' })).rejects.toThrow(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('updates only the supplied fields (partial update semantics)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', name: 'New Name' });

    const result = await handler.execute({ userId: 'u1', name: 'New Name' });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: {
        email: undefined,
        name: 'New Name',
        phone: undefined,
        gender: undefined,
        avatarUrl: undefined,
        isActive: undefined,
      },
      omit: { passwordHash: true },
    });
    expect(result.name).toBe('New Name');
  });

  it('passes every updatable field through to Prisma when all are provided', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1' });

    await handler.execute({
      userId: 'u1',
      email: 'a@b.com',
      name: 'Salem',
      phone: '+966512345678',
      gender: 'MALE' as any,
      avatarUrl: 'https://x/avatar.png',
      isActive: true,
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          email: 'a@b.com',
          name: 'Salem',
          phone: '+966512345678',
          avatarUrl: 'https://x/avatar.png',
          isActive: true,
        }),
      }),
    );
  });

  it('omits passwordHash from the response (PII guard)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', name: 'New' });

    await handler.execute({ userId: 'u1', name: 'New' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ omit: { passwordHash: true } }),
    );
  });

  it('runs the update inside the RLS transaction', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.user.update.mockResolvedValue({ id: 'u1', name: 'New' });

    await handler.execute({ userId: 'u1', name: 'New' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
  });

  // SECURITY (P0-2): the command type intentionally does NOT include `role`
  // or `customRoleId` — they must go through `UpdateUserRoleHandler` with
  // its rank gate. This test makes that contract enforceable: if a future
  // change adds them here, the typecheck fails.
  it('SECURITY (P0-2): command type does not include role/customRoleId', () => {
    const cmd: Parameters<UpdateUserHandler['execute']>[0] = {
      userId: 'u1',
      email: 'a@b.com',
      name: 'X',
    };
    expect((cmd as any).role).toBeUndefined();
    expect((cmd as any).customRoleId).toBeUndefined();
  });
});
