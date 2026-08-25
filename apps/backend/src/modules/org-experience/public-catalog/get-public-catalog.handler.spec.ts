import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../../infrastructure/cache';
import { PrismaService } from '../../../infrastructure/database';
import { MinioService } from '../../../infrastructure/storage/minio.service';
import { GetPublicCatalogHandler } from './get-public-catalog.handler';

describe('GetPublicCatalogHandler', () => {
  const prisma = {
    department: { findMany: jest.fn() },
    serviceCategory: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    organizationSettings: { findFirst: jest.fn() },
  };
  const cache = {
    getOrSet: jest.fn((_key: string, factory: () => unknown) => factory()),
  };
  const storage = {
    getSignedUrl: jest.fn((bucket: string, key: string) =>
      Promise.resolve(`https://signed.example.com/${bucket}/${key}?sig=test`),
    ),
  };
  let handler: GetPublicCatalogHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.getOrSet.mockImplementation((_key: string, factory: () => unknown) => factory());
    prisma.department.findMany.mockResolvedValue([]);
    prisma.serviceCategory.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.organizationSettings.findFirst.mockResolvedValue(null);
    handler = new GetPublicCatalogHandler(
      prisma as unknown as PrismaService,
      cache as unknown as CacheService,
      storage as unknown as MinioService,
      { getOrThrow: jest.fn().mockReturnValue('sawaa-media') } as unknown as ConfigService,
    );
  });

  it('preserves the public response while hiding price flags and signing images', async () => {
    prisma.department.findMany.mockResolvedValue([
      { id: 'dept-1', nameAr: 'عناية', isActive: true },
    ]);
    prisma.serviceCategory.findMany.mockResolvedValue([
      { id: 'cat-1', nameAr: 'إرشاد', isActive: true, imageUrl: 'org-1/category.png' },
    ]);
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'svc-1',
        nameAr: 'استشارة',
        imageUrl: 'org-1/service.png',
        hidePriceOnBooking: true,
        hideDurationOnBooking: false,
        durationOptions: [{ id: 'duration-1', durationMins: 30, price: 50 }],
      },
    ]);
    prisma.organizationSettings.findFirst.mockResolvedValue({
      vatRate: { toString: () => '0.15' },
    });

    const result = await handler.execute();

    expect(result).toEqual({
      departments: [{ id: 'dept-1', nameAr: 'عناية', isActive: true }],
      categories: [{
        id: 'cat-1',
        nameAr: 'إرشاد',
        isActive: true,
        imageUrl: 'https://signed.example.com/sawaa-media/org-1/category.png?sig=test',
      }],
      services: [{
        id: 'svc-1',
        nameAr: 'استشارة',
        imageUrl: 'https://signed.example.com/sawaa-media/org-1/service.png?sig=test',
        durationOptions: [{ id: 'duration-1', durationMins: 30, price: 50 }],
        showPrice: false,
        showDuration: true,
      }],
      vatRate: 0.15,
    });
    expect(cache.getOrSet).toHaveBeenCalledWith('ref:public-catalog', expect.any(Function), 300);
    expect(storage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/category.png', 300);
    expect(storage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/service.png', 300);
  });

  it('keeps the closed publication filters and archived-service exclusion at the query boundary', async () => {
    await handler.execute();

    expect(prisma.department.findMany).toHaveBeenCalledWith({
      where: { isActive: true, isVisible: true },
      orderBy: { sortOrder: 'asc' },
    });
    expect(prisma.serviceCategory.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    expect(prisma.service.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, isHidden: false, archivedAt: null },
      orderBy: { nameAr: 'asc' },
    }));
  });

  it('keeps an explicit public-safe service projection and excludes practitioner-owned duration rows', async () => {
    await handler.execute();

    const serviceQuery = prisma.service.findMany.mock.calls[0][0];
    expect(serviceQuery.include).toBeUndefined();
    expect(serviceQuery.select).toEqual(expect.objectContaining({
      id: true,
      categoryId: true,
      nameAr: true,
      nameEn: true,
      descriptionAr: true,
      descriptionEn: true,
      durationMins: true,
      price: true,
      currency: true,
      imageUrl: true,
      iconName: true,
      iconBgColor: true,
      hidePriceOnBooking: true,
      hideDurationOnBooking: true,
    }));
    expect(serviceQuery.select.durationOptions).toEqual(expect.objectContaining({
      where: { isActive: true, employeeServiceId: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        label: true,
        durationMins: true,
        price: true,
        sortOrder: true,
      },
    }));
    expect(serviceQuery.select.bookingConfigs).toEqual({
      where: { isActive: true },
      select: {
        id: true,
        deliveryType: true,
        price: true,
        durationMins: true,
      },
    });
    expect(serviceQuery.select.isActive).toBeUndefined();
    expect(serviceQuery.select.commissionRateOverride).toBeUndefined();
    expect(serviceQuery.select.depositAmount).toBeUndefined();
  });

  it('keeps null image URLs unsigned and defaults a missing VAT setting to zero', async () => {
    prisma.serviceCategory.findMany.mockResolvedValue([
      { id: 'cat-1', imageUrl: null },
    ]);

    const result = await handler.execute();

    expect(result.categories[0].imageUrl).toBeNull();
    expect(result.vatRate).toBe(0);
    expect(storage.getSignedUrl).not.toHaveBeenCalled();
  });
});
