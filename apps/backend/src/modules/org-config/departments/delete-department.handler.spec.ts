import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DeleteDepartmentHandler } from './delete-department.handler';
import { PrismaService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';

describe('DeleteDepartmentHandler', () => {
  let handler: DeleteDepartmentHandler;
  let prisma: { department: { deleteMany: jest.Mock } };
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = { department: { deleteMany: jest.fn() } };
    cache = { invalidatePrefix: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        DeleteDepartmentHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    handler = module.get(DeleteDepartmentHandler);
  });

  it('throws NotFoundException when department is missing', async () => {
    prisma.department.deleteMany.mockResolvedValue({ count: 0 });
    await expect(handler.execute({ departmentId: 'missing' })).rejects.toThrow(NotFoundException);
  });

  it('returns deleted:true and invalidates the departments cache on success', async () => {
    prisma.department.deleteMany.mockResolvedValue({ count: 1 });
    const result = await handler.execute({ departmentId: 'd1' });
    expect(result).toEqual({ deleted: true });
    expect(cache.invalidatePrefix).toHaveBeenCalledWith('ref:departments:');
  });
});