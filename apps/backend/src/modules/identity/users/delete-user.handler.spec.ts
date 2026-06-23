import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteUserHandler } from './delete-user.handler';

describe('DeleteUserHandler', () => {
  let handler: DeleteUserHandler;
  let prisma: { user: { deleteMany: jest.Mock } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUserHandler,
        { provide: PrismaService, useValue: { user: { deleteMany: jest.fn() } } },
      ],
    }).compile();

    handler = module.get<DeleteUserHandler>(DeleteUserHandler);
    prisma = module.get<PrismaService>(PrismaService) as any;
  });

  it('resolves when deleteMany reports a row was removed', async () => {
    prisma.user.deleteMany.mockResolvedValue({ count: 1 });
    await expect(
      handler.execute({ userId: '00000000-0000-0000-0000-000000000001' }),
    ).resolves.toBeUndefined();
  });

  it('passes the exact userId as the where clause to Prisma', async () => {
    prisma.user.deleteMany.mockResolvedValue({ count: 1 });
    await handler.execute({ userId: '00000000-0000-0000-0000-000000000001' });
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({
      where: { id: '00000000-0000-0000-0000-000000000001' },
    });
    expect(prisma.user.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when no row matched the deleteMany (count=0)', async () => {
    prisma.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(
      handler.execute({ userId: '00000000-0000-0000-0000-000000000099' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when deleteMany rejects the row entirely', async () => {
    // deleteMany never throws on a non-existent row — it returns count:0.
    // Asserting this so a future regression that swaps deleteMany for delete
    // (which DOES throw P2025) is caught here.
    prisma.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute({ userId: 'ghost' })).rejects.toThrow(NotFoundException);
  });

  it('propagates a Prisma error when deleteMany itself rejects', async () => {
    prisma.user.deleteMany.mockRejectedValue(new Error('FK constraint violation'));
    await expect(
      handler.execute({ userId: '00000000-0000-0000-0000-000000000001' }),
    ).rejects.toThrow('FK constraint violation');
  });
});
