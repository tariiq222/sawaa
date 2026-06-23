import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';
import { UpdateCategoryHandler } from './update-category.handler';

describe('UpdateCategoryHandler', () => {
  let handler: UpdateCategoryHandler;
  let prisma: any;
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = {
      serviceCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', bookingMode: 'SERVICES' }),
        update: jest.fn().mockResolvedValue({ id: 'c1', bookingMode: 'SERVICES' }),
      },
      service: { findFirst: jest.fn(), create: jest.fn() },
    };
    cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        UpdateCategoryHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) },
        },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get(UpdateCategoryHandler);
  });

  it('throws NotFoundException when the category does not exist', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue(null);

    await expect(
      handler.execute({ categoryId: 'missing', nameAr: 'x', nameEn: 'x' } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
    expect(cache.invalidatePrefix).not.toHaveBeenCalled();
  });

  it('passes only the defined fields to the update', async () => {
    await handler.execute({ categoryId: 'c1', nameAr: 'شعر', nameEn: 'Hair' } as never);

    expect(prisma.serviceCategory.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { nameAr: 'شعر', nameEn: 'Hair' },
    });
  });

  it('invalidates both categories and departments cache prefixes after a write', async () => {
    await handler.execute({ categoryId: 'c1', nameAr: 'x', nameEn: 'x' } as never);

    expect(cache.invalidatePrefix).toHaveBeenCalledWith(CATEGORIES_CACHE_PREFIX);
    expect(cache.invalidatePrefix).toHaveBeenCalledWith(DEPARTMENTS_CACHE_PREFIX);
  });

  it('skips creating a hidden service for SERVICES-mode categories', async () => {
    prisma.serviceCategory.update.mockResolvedValue({ id: 'c1', bookingMode: 'SERVICES' });

    await handler.execute({ categoryId: 'c1', nameAr: 'x', nameEn: 'x' } as never);

    expect(prisma.service.create).not.toHaveBeenCalled();
  });
});