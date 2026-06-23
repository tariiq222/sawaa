import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DeleteRoleHandler } from './delete-role.handler';

describe('DeleteRoleHandler', () => {
  let handler: DeleteRoleHandler;
  let prisma: { customRole: { findFirst: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };
  let tx: {
    user: { updateMany: jest.Mock };
    customRole: { delete: jest.Mock };
  };

  beforeEach(async () => {
    prisma = { customRole: { findFirst: jest.fn() } };
    tx = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      customRole: { delete: jest.fn().mockResolvedValue({ id: 'r1' }) },
    };
    rlsTransaction = {
      withTransaction: jest.fn((cb: any) => cb(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRoleHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: RlsTransactionService, useValue: rlsTransaction },
      ],
    }).compile();

    handler = module.get<DeleteRoleHandler>(DeleteRoleHandler);
  });

  it('throws NotFoundException when the role does not exist (no role row)', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'ghost' })).rejects.toThrow(NotFoundException);
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when attempting to delete a SYSTEM role', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', isSystem: true });
    await expect(handler.execute({ customRoleId: 'r1' })).rejects.toThrow(ForbiddenException);
    expect(rlsTransaction.withTransaction).not.toHaveBeenCalled();
  });

  it('checks for isSystem=true by selecting only id + isSystem (lean query)', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', isSystem: false });
    await handler.execute({ customRoleId: 'r1' });

    expect(prisma.customRole.findFirst).toHaveBeenCalledWith({
      where: { id: 'r1' },
      select: { id: true, isSystem: true },
    });
  });

  it('resets customRoleId=null for every user holding the role AND deletes the role in one transaction', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', isSystem: false });

    await handler.execute({ customRoleId: 'r1' });

    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { customRoleId: 'r1' },
      data: { customRoleId: null },
    });
    expect(tx.customRole.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('runs the user update and the role delete inside the SAME transaction (no orphan rows)', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', isSystem: false });

    // The two operations are passed in via Promise.all inside a single
    // withTransaction call, so a failure of one rolls back the other.
    await handler.execute({ customRoleId: 'r1' });
    expect(rlsTransaction.withTransaction).toHaveBeenCalledTimes(1);
  });

  it('propagates the user-updateMany failure when the cleanup throws', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'r1', isSystem: false });
    tx.user.updateMany.mockRejectedValue(new Error('FK violation'));

    await expect(handler.execute({ customRoleId: 'r1' })).rejects.toThrow('FK violation');
  });
});
