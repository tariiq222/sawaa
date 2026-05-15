import { Test, TestingModule } from '@nestjs/testing';
import { ListUsersHandler } from './list-users.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListUsersHandler', () => {
  let handler: ListUsersHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListUsersHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListUsersHandler>(ListUsersHandler);
  });

  it('should list users with search', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10, search: 'admin', isActive: true });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        isActive: true,
        OR: [{ name: { contains: 'admin', mode: 'insensitive' } }, { email: { contains: 'admin', mode: 'insensitive' } }],
      }),
    }));
  });

  it('should list users without search', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10 });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: undefined },
    }));
  });
});
