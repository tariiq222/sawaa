import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';
import { SERVICES_CACHE_PREFIX } from '../../org-experience/services/services.cache';
import { UpdateCategoryHandler } from './update-category.handler';

describe('UpdateCategoryHandler', () => {
  let handler: UpdateCategoryHandler;
  let prisma: any;
  let cache: { invalidatePrefix: jest.Mock };
  let storage: { getSignedUrl: jest.Mock };

  beforeEach(async () => {
    prisma = {
      serviceCategory: {
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', bookingMode: 'SERVICES' }),
        update: jest.fn().mockResolvedValue({ id: 'c1', bookingMode: 'SERVICES' }),
      },
      service: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };
    storage = {
      getSignedUrl: jest.fn((bucket: string, key: string) =>
        Promise.resolve(`https://signed.example.com/${bucket}/${key}?sig=test`),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        UpdateCategoryHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) },
        },
        { provide: CacheService, useValue: cache },
        { provide: MinioService, useValue: storage },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'sawaa-media') } },
      ],
    }).compile();

    handler = module.get(UpdateCategoryHandler);
  });

  it('returns a freshly signed presigned URL for a persisted image key', async () => {
    prisma.serviceCategory.update.mockResolvedValue({
      id: 'c1',
      bookingMode: 'SERVICES',
      imageUrl: 'org-1/abc.png',
    });

    const result = await handler.execute({ categoryId: 'c1', imageUrl: 'org-1/abc.png' } as never);

    expect(storage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/abc.png', 300);
    expect(result.imageUrl).toBe('https://signed.example.com/sawaa-media/org-1/abc.png?sig=test');
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
    expect(cache.invalidatePrefix).toHaveBeenCalledWith(SERVICES_CACHE_PREFIX);
  });

  it('skips creating a hidden service for SERVICES-mode categories', async () => {
    prisma.serviceCategory.update.mockResolvedValue({ id: 'c1', bookingMode: 'SERVICES' });

    await handler.execute({ categoryId: 'c1', nameAr: 'x', nameEn: 'x' } as never);

    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('rejects a booking mode transition before writing', async () => {
    await expect(handler.execute({ categoryId: 'c1', bookingMode: 'DIRECT' } as never))
      .rejects.toMatchObject({ status: 409 });
    expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
  });

  it('permits an unchanged booking mode', async () => {
    await handler.execute({ categoryId: 'c1', bookingMode: 'SERVICES' } as never);
    expect(prisma.serviceCategory.update).toHaveBeenCalled();
  });

  it('rejects changing a DIRECT clinic to a SERVICE_GROUP', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue({ id: 'c1', bookingMode: 'DIRECT', kind: 'CLINIC' });
    await expect(handler.execute({ categoryId: 'c1', kind: 'SERVICE_GROUP' } as never))
      .rejects.toMatchObject({ status: 400 });
    expect(prisma.serviceCategory.update).not.toHaveBeenCalled();
  });

  it('renames the existing internal service in the same transaction', async () => {
    prisma.serviceCategory.findFirst.mockResolvedValue({ id: 'c1', bookingMode: 'DIRECT', kind: 'CLINIC' });
    prisma.serviceCategory.update.mockResolvedValue({ id: 'c1', nameAr: 'عيادة جديدة', nameEn: 'New clinic', bookingMode: 'DIRECT' });
    prisma.service.findFirst.mockResolvedValue({ id: 'internal' });
    await handler.execute({ categoryId: 'c1', nameAr: 'عيادة جديدة', nameEn: 'New clinic' } as never);
    expect(prisma.service.update).toHaveBeenCalledWith({
      where: { id: 'internal' }, data: { nameAr: 'عيادة جديدة', nameEn: 'New clinic' },
    });
  });
});
