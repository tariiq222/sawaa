import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { DeleteCategoryHandler } from './delete-category.handler';

describe('DeleteCategoryHandler', () => {
  let handler: DeleteCategoryHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCategoryHandler,
        { provide: PrismaService, useValue: {
    serviceCategory: { findFirst: jest.fn(), delete: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<DeleteCategoryHandler>(DeleteCategoryHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({ categoryId: 'test' } as any);
    
    (prisma.serviceCategory.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({ categoryId: 'test' } as any)).rejects.toThrow();
  });
});
