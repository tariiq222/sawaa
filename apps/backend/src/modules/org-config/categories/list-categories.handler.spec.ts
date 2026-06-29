import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { CacheService } from '../../../infrastructure/cache';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { ListCategoriesHandler } from './list-categories.handler';

describe('ListCategoriesHandler', () => {
  let handler: ListCategoriesHandler;
  let cache: { getOrSet: jest.Mock; invalidatePrefix: jest.Mock };
  let rls: { withTransaction: jest.Mock };
  let storage: { getSignedUrl: jest.Mock };

  beforeEach(async () => {
    cache = {
      getOrSet: jest.fn((_k: string, l: () => Promise<unknown>) => l()),
      invalidatePrefix: jest.fn(),
    };
    rls = {
      withTransaction: jest.fn((cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          serviceCategory: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'c1', nameAr: 'شعر', nameEn: 'Hair', bookingMode: 'SERVICES', _count: { services: 3 }, department: null },
              { id: 'c2', nameAr: 'استشارة', nameEn: 'Consult', bookingMode: 'DIRECT', _count: { services: 0 }, department: null },
            ]),
            count: jest.fn().mockResolvedValue(2),
          },
        }),
      ),
    };

    storage = {
      getSignedUrl: jest.fn((bucket: string, key: string) =>
        Promise.resolve(`https://signed.example.com/${bucket}/${key}?sig=test`),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        ListCategoriesHandler,
        { provide: PrismaService, useValue: {} },
        { provide: RlsTransactionService, useValue: rls },
        { provide: CacheService, useValue: cache },
        { provide: MinioService, useValue: storage },
        { provide: ConfigService, useValue: { getOrThrow: jest.fn(() => 'sawaa-media') } },
      ],
    }).compile();

    handler = module.get(ListCategoriesHandler);
  });

  it('signs a non-null category imageUrl into a fresh presigned URL at read time', async () => {
    rls.withTransaction.mockImplementationOnce((cb: any) =>
      cb({
        serviceCategory: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'c1', nameAr: 'شعر', bookingMode: 'SERVICES', imageUrl: 'org-1/abc.png', _count: { services: 1 }, department: null },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
      }),
    );

    const result = await handler.execute({} as never);

    expect(storage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/abc.png', 300);
    expect(result.items[0].imageUrl).toBe('https://signed.example.com/sawaa-media/org-1/abc.png?sig=test');
  });

  it('leaves a null category imageUrl as null without signing', async () => {
    rls.withTransaction.mockImplementationOnce((cb: any) =>
      cb({
        serviceCategory: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'c1', nameAr: 'شعر', bookingMode: 'SERVICES', imageUrl: null, _count: { services: 1 }, department: null },
          ]),
          count: jest.fn().mockResolvedValue(1),
        },
      }),
    );

    const result = await handler.execute({} as never);

    expect(result.items[0].imageUrl).toBeNull();
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });

  it('passes departmentId, isActive and search into the where clause', async () => {
    await handler.execute({ departmentId: 'd1', isActive: true, search: 'شعر' } as never);

    const findManyArgs = (rls.withTransaction.mock.calls[0][0](
      { serviceCategory: { findMany: jest.fn(), count: jest.fn() } },
    ) as any).then ? null : null;
    // Use a capturing tx to inspect the args.
    let captured: any = null;
    rls.withTransaction.mockImplementationOnce((cb: any) =>
      cb({
        serviceCategory: {
          findMany: jest.fn().mockImplementation((args: any) => {
            captured = args;
            return [{ id: 'c1', _count: { services: 1 } }];
          }),
          count: jest.fn().mockResolvedValue(1),
        },
      }),
    );
    await handler.execute({ departmentId: 'd1', isActive: true, search: 'شعر' } as never);

    expect(captured.where).toEqual({
      departmentId: 'd1',
      isActive: true,
      OR: [
        { nameAr: { contains: 'شعر', mode: 'insensitive' } },
        { nameEn: { contains: 'شعر', mode: 'insensitive' } },
      ],
    });
    void findManyArgs;
  });

  it('overrides the bookable-service count for DIRECT-mode categories (minimum 1)', async () => {
    const result = await handler.execute({} as never);
    const servicesCount = result.items[1]._count.services;
    expect(servicesCount).toBe(1); // DIRECT mode with 0 services bumped to 1
    expect(result.items[0]._count.services).toBe(3); // SERVICES mode unchanged
  });

  it('caches the response via CacheService.getOrSet and the deterministic key', async () => {
    await handler.execute({ departmentId: 'd1', page: 1, limit: 20 } as never);
    expect(cache.getOrSet).toHaveBeenCalledTimes(1);
    const cacheKey = cache.getOrSet.mock.calls[0][0];
    expect(cacheKey).toContain('d1');
  });
});