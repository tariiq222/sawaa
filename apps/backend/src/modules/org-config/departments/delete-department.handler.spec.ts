import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { DeleteDepartmentHandler } from './delete-department.handler';

describe('DeleteDepartmentHandler', () => {
  let handler: DeleteDepartmentHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteDepartmentHandler,
        { provide: PrismaService, useValue: {
    department: { deleteMany: jest.fn() }
        } },
        { provide: CacheService, useValue: { getOrSet: (_k: string, l: () => Promise<unknown>) => l(), invalidatePrefix: jest.fn() } },
      ],
    }).compile();

    handler = module.get<DeleteDepartmentHandler>(DeleteDepartmentHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute successfully', async () => {
    (prisma.department.deleteMany as jest.Mock).mockResolvedValue({ id: 'test-id' });
    const result = await handler.execute({departmentId:"00000000-0000-0000-0000-000000000001"});
    expect(result).toBeDefined();
    
    (prisma.department.deleteMany as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({departmentId:"00000000-0000-0000-0000-000000000001"})).rejects.toThrow();
  });
});
