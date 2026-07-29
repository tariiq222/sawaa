import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UpdateDepartmentHandler } from './update-department.handler';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

describe('UpdateDepartmentHandler', () => {
  let handler: UpdateDepartmentHandler;
  let prisma: {
    department: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = { department: { findFirst: jest.fn(), updateMany: jest.fn() } };
    cache = { invalidatePrefix: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        UpdateDepartmentHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    handler = module.get(UpdateDepartmentHandler);
  });

  const dto = { departmentId: 'd1', nameAr: 'قسم محدّث' } as Parameters<UpdateDepartmentHandler['execute']>[0];

  it('throws NotFoundException when updateMany returns count 0', async () => {
    prisma.department.updateMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when another department already owns the new Arabic name', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: 'other' });
    await expect(handler.execute(dto)).rejects.toThrow(ConflictException);
  });

  it('updates and returns the department', async () => {
    prisma.department.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'd1', nameAr: 'قسم محدّث' });
    prisma.department.updateMany.mockResolvedValue({ count: 1 });
    const result = await handler.execute(dto);
    expect(result?.id).toBe('d1');
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('ref:departments:');
  });
});