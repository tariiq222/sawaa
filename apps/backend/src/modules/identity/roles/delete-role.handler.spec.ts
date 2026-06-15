import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DeleteRoleHandler } from './delete-role.handler';

describe('DeleteRoleHandler', () => {
  let handler: DeleteRoleHandler;
  let prisma: { customRole: { findFirst: jest.Mock } };
  let rlsTransaction: { withTransaction: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRoleHandler,
        {
          provide: PrismaService,
          useValue: {
            customRole: { findFirst: jest.fn() },
          },
        },
        {
          provide: RlsTransactionService,
          useValue: {
            withTransaction: jest.fn((cb: any) =>
              cb({
                user: { updateMany: jest.fn() },
                customRole: { delete: jest.fn() },
              }),
            ),
          },
        },
      ],
    }).compile();

    handler = module.get<DeleteRoleHandler>(DeleteRoleHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
    rlsTransaction = module.get<RlsTransactionService>(RlsTransactionService) as any;
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should delete a non-system role', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: false });
    await handler.execute({ customRoleId: 'role' });
    expect(rlsTransaction.withTransaction).toHaveBeenCalled();
  });

  it('should throw NotFoundException when role not found', async () => {
    prisma.customRole.findFirst.mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'role' })).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException when attempting to delete a system role', async () => {
    prisma.customRole.findFirst.mockResolvedValue({ id: 'role', isSystem: true });
    await expect(handler.execute({ customRoleId: 'role' })).rejects.toThrow(ForbiddenException);
  });
});
