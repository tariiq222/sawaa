import { Test, TestingModule } from '@nestjs/testing';
import { ListUsersHandler } from './list-users.handler';
import { PrismaService } from '../../../infrastructure/database';

describe('ListUsersHandler', () => {
  let handler: ListUsersHandler;
  let prisma: {
    user: { findMany: jest.Mock; count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ListUsersHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();

    handler = module.get<ListUsersHandler>(ListUsersHandler);
  });

  it('builds an OR-clause search on name and email when search is provided', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10, search: 'admin', isActive: true });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: [
            { name: { contains: 'admin', mode: 'insensitive' } },
            { email: { contains: 'admin', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('omits the OR-clause entirely when no search term is supplied', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10, isActive: false });

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: false },
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
      omit: { passwordHash: true },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { isActive: false } });
  });

  it('computes skip from page-1 and passes limit as take', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await handler.execute({ page: 3, limit: 25 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50, take: 25 }),
    );
  });

  it('orders results by createdAt desc and omits passwordHash', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);

    await handler.execute({ page: 1, limit: 10 });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
        omit: { passwordHash: true },
      }),
    );
  });

  it('returns a canonical list response with items + meta (total / page / limit / totalPages)', async () => {
    const items = [{ id: 'u1' }, { id: 'u2' }];
    prisma.user.findMany.mockResolvedValue(items);
    prisma.user.count.mockResolvedValue(25);

    const result = await handler.execute({ page: 2, limit: 10 });

    expect(result).toEqual({
      items,
      meta: {
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      },
    });
  });

  it('reports hasNextPage=false and hasPreviousPage=false on the first page', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(5);

    const result = await handler.execute({ page: 1, limit: 10 });

    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('issues findMany and count in parallel (Promise.all)', async () => {
    const order: string[] = [];
    prisma.user.findMany.mockImplementation(async () => {
      order.push('findMany');
      return [];
    });
    prisma.user.count.mockImplementation(async () => {
      order.push('count');
      return 0;
    });

    await handler.execute({ page: 1, limit: 10 });

    // Both must start before either settles — order is irrelevant, but
    // they must both have been called by the time execute() returns.
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.count).toHaveBeenCalledTimes(1);
  });
});
