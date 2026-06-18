import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { UpdateCategoryHandler } from './update-category.handler';

describe('UpdateCategoryHandler', () => {
  let handler: UpdateCategoryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateCategoryHandler,
        { provide: PrismaService, useValue: {
    serviceCategory: { findFirst: jest.fn(), update: jest.fn() }
        } },
        { provide: RlsTransactionService, useValue: {
    withTransaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn({ serviceCategory: { update: jest.fn().mockResolvedValue({ id: 'test', bookingMode: 'SERVICES' }) }, service: { findFirst: jest.fn(), create: jest.fn() } }))
        } },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<UpdateCategoryHandler>(UpdateCategoryHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({categoryId:"00000000-0000-0000-0000-000000000001",nameAr:"Test",nameEn:"Test",departmentId:"00000000-0000-0000-0000-000000000001",sortOrder:1,isActive:true});
    
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({categoryId:"00000000-0000-0000-0000-000000000001",nameAr:"Test",nameEn:"Test",departmentId:"00000000-0000-0000-0000-000000000001",sortOrder:1,isActive:true})).rejects.toThrow();
  });
});
