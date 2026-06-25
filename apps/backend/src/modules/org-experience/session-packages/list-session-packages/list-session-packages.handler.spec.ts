import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../../infrastructure/database';
import { ListSessionPackagesHandler } from './list-session-packages.handler';

function buildPrisma() {
  return {
    sessionPackage: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('ListSessionPackagesHandler', () => {
  let handler: ListSessionPackagesHandler;
  let prisma: ReturnType<typeof buildPrisma>;

  beforeEach(async () => {
    prisma = buildPrisma();
    const module = await Test.createTestingModule({
      providers: [ListSessionPackagesHandler, { provide: PrismaService, useValue: prisma }],
    }).compile();
    handler = module.get(ListSessionPackagesHandler);
  });

  it('is defined', () => {
    expect(handler).toBeDefined();
  });

  it('returns an empty list when no packages match', async () => {
    const res = await handler.execute({});
    expect(res.items).toEqual([]);
    expect(res.meta.total).toBe(0);
    expect(res.meta.page).toBe(1);
    expect(res.meta.perPage).toBe(20);
  });

  it('always filters out archived packages', async () => {
    await handler.execute({});
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
  });

  it('applies isActive filter when provided', async () => {
    await handler.execute({ isActive: true } as any);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('applies isPublic filter when provided', async () => {
    await handler.execute({ isPublic: true } as any);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPublic: true }),
      }),
    );
  });

  it('builds a case-insensitive OR search over nameAr + nameEn', async () => {
    await handler.execute({ search: 'family' } as any);
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { nameAr: { contains: 'family', mode: 'insensitive' } },
            { nameEn: { contains: 'family', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('returns total + items and computes meta correctly', async () => {
    prisma.sessionPackage.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    prisma.sessionPackage.count.mockResolvedValue(2);
    const res = await handler.execute({});
    expect(res.items).toHaveLength(2);
    expect(res.meta.total).toBe(2);
    expect(res.meta.totalPages).toBe(1);
    expect(res.meta.hasNextPage).toBe(false);
  });

  it('honors a custom page + limit', async () => {
    await handler.execute({ page: 3, limit: 5 } as any);
    const call = prisma.sessionPackage.findMany.mock.calls[0][0];
    expect(call.skip).toBe(10); // (3 - 1) * 5
    expect(call.take).toBe(5);
  });

  it('orders by sortOrder then createdAt desc', async () => {
    await handler.execute({});
    expect(prisma.sessionPackage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    );
  });
});