import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateDepartmentHandler } from './create-department.handler';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

describe('CreateDepartmentHandler', () => {
  let handler: CreateDepartmentHandler;
  let prisma: { department: { findFirst: jest.Mock; create: jest.Mock } };
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = { department: { findFirst: jest.fn(), create: jest.fn() } };
    cache = { invalidatePrefix: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        CreateDepartmentHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    handler = module.get(CreateDepartmentHandler);
  });

  const dto = {
    nameAr: 'قسم الإرشاد',
    nameEn: 'Counseling',
    isActive: true,
    isVisible: true,
  };

  it('throws ConflictException when Arabic name already exists', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
  });

  it('creates the department and invalidates the departments cache', async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    prisma.department.create.mockResolvedValue({ id: 'd1', ...dto });
    const result = await handler.execute(dto);
    expect(result.id).toBe('d1');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('ref:departments:');
  });
});