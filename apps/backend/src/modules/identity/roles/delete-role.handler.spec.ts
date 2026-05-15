import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteRoleHandler } from './delete-role.handler';

describe('DeleteRoleHandler', () => {
  let handler: DeleteRoleHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRoleHandler,
        { provide: PrismaService, useValue: {
          customRole: { findFirst: jest.fn() },
          $transaction: jest.fn(),
        } },
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
    (prisma.$transaction as jest.Mock).mockResolvedValue([{ count: 1 }, { id: 'role' }]);
    await handler.execute({ customRoleId: 'role' });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('should throw when role not found', async () => {
    (prisma.customRole.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ customRoleId: 'role' })).rejects.toThrow();
  });
});
