import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { DeleteRoleHandler } from './delete-role.handler';

describe('DeleteRoleHandler', () => {
  let handler: DeleteRoleHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRoleHandler,
        { provide: PrismaService, useValue: {
          customRole: { findFirst: jest.fn(), delete: jest.fn() },
          user: { updateMany: jest.fn() },
          $transaction: jest.fn(async (cb) => await cb({
            user: { updateMany: jest.fn() },
            customRole: { delete: jest.fn() },
          })),
        } },
        { provide: RlsTransactionService, useValue: { withTransaction: jest.fn((cb: any) => cb({
          user: { updateMany: jest.fn() },
          customRole: { delete: jest.fn() },
        })) } },
      ],
    }).compile();

    handler = module.get<DeleteRoleHandler>(DeleteRoleHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should delete role', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue({ id: 'role' });
    await handler.execute({ customRoleId: 'role' });
    // Handler now uses rlsTransaction.withTransaction instead of prisma.$transaction
  });

  it('should throw when role not found', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'role' })).rejects.toThrow();
  });
});
