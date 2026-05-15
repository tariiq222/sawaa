import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database';
import { CreateDepartmentHandler } from './create-department.handler';

describe('CreateDepartmentHandler', () => {
  let handler: CreateDepartmentHandler;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDepartmentHandler,
        { provide: PrismaService, useValue: {
          department: { findFirst: jest.fn(), create: jest.fn() },
        } },
      ],
    }).compile();

    handler = module.get<CreateDepartmentHandler>(CreateDepartmentHandler);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create department', async () => {
    (prisma.department.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.department.create as jest.Mock).mockResolvedValue({ id: 'test' });
    await handler.execute({ nameAr: 'قسم', nameEn: 'Dept', descriptionAr: '', descriptionEn: '', icon: '', isActive: true, isVisible: true, sortOrder: 0 });
    expect(prisma.department.create).toHaveBeenCalled();
  });

  it('should throw when nameAr exists', async () => {
    (prisma.department.findFirst as jest.Mock).mockResolvedValue({ id: 'existing' });
    await expect(handler.execute({ nameAr: 'قسم', nameEn: 'Dept', descriptionAr: '', descriptionEn: '', icon: '', isActive: true, isVisible: true, sortOrder: 0 })).rejects.toThrow();
  });
});
