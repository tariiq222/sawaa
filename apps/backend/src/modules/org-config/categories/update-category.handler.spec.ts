import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
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
