import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CreateCategoryHandler } from './create-category.handler';

describe('CreateCategoryHandler', () => {
  let handler: CreateCategoryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateCategoryHandler,
        { provide: PrismaService, useValue: {
    serviceCategory: { create: jest.fn() }
        } },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<CreateCategoryHandler>(CreateCategoryHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.serviceCategory.create as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({nameAr:"Test Name",nameEn:"Test Name",departmentId:"00000000-0000-0000-0000-000000000001",sortOrder:1});
    expect(result).toBeDefined();
  });
});
