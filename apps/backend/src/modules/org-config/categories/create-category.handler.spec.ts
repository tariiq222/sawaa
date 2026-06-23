import { Test } from '@nestjs/testing';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { CATEGORIES_CACHE_PREFIX } from './categories.cache';
import { DEPARTMENTS_CACHE_PREFIX } from '../departments/departments.cache';
import { CreateCategoryHandler } from './create-category.handler';

describe('CreateCategoryHandler', () => {
  let handler: CreateCategoryHandler;
  let prisma: any;
  let cache: { invalidatePrefix: jest.Mock };

  beforeEach(async () => {
    prisma = {
      serviceCategory: {
        create: jest.fn().mockResolvedValue({ id: 'c-new', nameAr: 'شعر', bookingMode: 'SERVICES' }),
      },
    };
    cache = { invalidatePrefix: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        CreateCategoryHandler,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RlsTransactionService,
          useValue: { withTransaction: jest.fn((cb: any) => cb(prisma)) },
        },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();

    handler = module.get(CreateCategoryHandler);
  });

  it('creates a SERVICES-mode category without a hidden service row', async () => {
    const result = await handler.execute({
      nameAr: 'شعر',
      nameEn: 'Hair',
      departmentId: '00000000-0000-0000-0000-000000000001',
      sortOrder: 1,
    } as never);

    expect(result.id).toBe('c-new');
    expect(prisma.serviceCategory.create).toHaveBeenCalledTimes(1);
  });

  it('creates a hidden Service row when bookingMode is DIRECT', async () => {
    prisma.serviceCategory.create.mockResolvedValue({ id: 'c-dir', bookingMode: 'DIRECT' });
    prisma.service = { create: jest.fn().mockResolvedValue({ id: 'svc-hidden' }) };

    await handler.execute({
      nameAr: 'استشارة',
      nameEn: 'Consult',
      bookingMode: 'DIRECT',
    } as never);

    expect(prisma.service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: 'c-dir',
          nameAr: 'استشارة',
          isHidden: true,
          isActive: true,
          price: expect.anything(),
          durationMins: 30,
        }),
      }),
    );
  });

  it('invalidates both categories and departments cache prefixes after a write', async () => {
    await handler.execute({ nameAr: 'x', nameEn: 'x' } as never);

    expect(cache.invalidatePrefix).toHaveBeenCalledWith(CATEGORIES_CACHE_PREFIX);
    expect(cache.invalidatePrefix).toHaveBeenCalledWith(DEPARTMENTS_CACHE_PREFIX);
  });
});