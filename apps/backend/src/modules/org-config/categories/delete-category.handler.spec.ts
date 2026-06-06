import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { DeleteCategoryHandler } from './delete-category.handler';

describe('DeleteCategoryHandler', () => {
  let handler: DeleteCategoryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCategoryHandler,
        { provide: PrismaService, useValue: {
    serviceCategory: { findFirst: jest.fn(), delete: jest.fn().mockResolvedValue({ id: 'test' }) },
    service: { count: jest.fn() }
        } },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<DeleteCategoryHandler>(DeleteCategoryHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('deletes category when no non-archived services exist', async () => {
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    (prisma.service.count as jest.Mock).mockResolvedValue(0);
    await handler.execute({ categoryId: 'test' } as any);

    expect(prisma.service.count).toHaveBeenCalledWith({
      where: { categoryId: 'test', archivedAt: null },
    });
    expect(prisma.serviceCategory.delete).toHaveBeenCalledWith({ where: { id: 'test' } });
  });

  it('throws NotFoundException when category is missing', async () => {
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ categoryId: 'test' } as any)).rejects.toThrow(NotFoundException);
    expect(prisma.service.count).not.toHaveBeenCalled();
  });

  it('blocks deletion when non-archived services exist', async () => {
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    (prisma.service.count as jest.Mock).mockResolvedValue(1);

    await expect(handler.execute({ categoryId: 'test' } as any)).rejects.toThrow(BadRequestException);
    expect(prisma.serviceCategory.delete).not.toHaveBeenCalled();
  });
});
