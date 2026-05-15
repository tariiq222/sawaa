import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { UpdateDepartmentHandler } from './update-department.handler';

describe('UpdateDepartmentHandler', () => {
  let handler: UpdateDepartmentHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateDepartmentHandler,
        { provide: PrismaService, useValue: {
    department: { updateMany: jest.fn(), findFirst: jest.fn() }
        } },
      ],
    }).compile();

    handler = module.get<UpdateDepartmentHandler>(UpdateDepartmentHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should execute', async () => {
    (prisma.department.updateMany as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({departmentId:"00000000-0000-0000-0000-000000000001",nameAr:"Test",nameEn:"Test",descriptionAr:"test",descriptionEn:"test",icon:"test",isVisible:true,sortOrder:"test",isActive:true});
    
    (prisma.department.updateMany as jest.Mock).mockResolvedValue(null);
    await expect(handler.execute({departmentId:"00000000-0000-0000-0000-000000000001",nameAr:"Test",nameEn:"Test",descriptionAr:"test",descriptionEn:"test",icon:"test",isVisible:true,sortOrder:"test",isActive:true})).rejects.toThrow();
  });
});
