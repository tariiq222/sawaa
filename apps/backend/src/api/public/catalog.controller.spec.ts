import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigService } from '@nestjs/config';
import { PublicCatalogController } from './catalog.controller';
import { PrismaService } from '../../infrastructure/database';
import { CacheService } from '../../infrastructure/cache';
import { MinioService } from '../../infrastructure/storage/minio.service';
import { GetPractitionerBookingOptionsHandler } from '../../modules/org-experience/services/get-practitioner-booking-options/get-practitioner-booking-options.handler';

describe('PublicCatalogController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    department: { findMany: jest.fn() },
    serviceCategory: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    organizationSettings: { findFirst: jest.fn() },
  };

  const mockGetPractitionerBookingOptions = { execute: jest.fn() };
  const mockCache = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    getOrSet: jest.fn((_key: string, factory: () => unknown) => factory()),
  };

  // Mints a deterministic "signed" URL so tests can assert the stored key was
  // run through getSignedUrl rather than returned raw.
  const mockStorage = {
    getSignedUrl: jest.fn((bucket: string, key: string) =>
      Promise.resolve(`https://signed.example.com/${bucket}/${key}?sig=test`),
    ),
  };
  const mockConfig = { getOrThrow: jest.fn(() => 'sawaa-media') };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicCatalogController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: GetPractitionerBookingOptionsHandler, useValue: mockGetPractitionerBookingOptions },
        { provide: CacheService, useValue: mockCache },
        { provide: MinioService, useValue: mockStorage },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /public/services', () => {
    it('returns 200 with catalog data', async () => {
      mockPrisma.department.findMany.mockResolvedValue([
        { id: 'dept-1', nameAr: 'عناية', isActive: true },
      ]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([
        { id: 'cat-1', nameAr: 'شعر', isActive: true, imageUrl: 'org-1/abc.png' },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([
        {
          id: 'svc-1',
          nameAr: 'قص الشعر',
          imageUrl: 'org-1/svc.png',
          hidePriceOnBooking: true,
          hideDurationOnBooking: false,
          durationOptions: [{ id: 'do-1', durationMins: 30, price: 50 }],
        },
      ]);
      mockPrisma.organizationSettings.findFirst.mockResolvedValue({ vatRate: 0.15 });

      const res = await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(res.body.departments).toHaveLength(1);
      expect(res.body.categories).toHaveLength(1);
      // imageUrl is minted into a fresh short-lived presigned URL at read time,
      // never returned as the raw stored object key (audit D.1).
      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/abc.png', 300);
      expect(res.body.categories[0].imageUrl).toBe(
        'https://signed.example.com/sawaa-media/org-1/abc.png?sig=test',
      );
      expect(res.body.services).toHaveLength(1);
      expect(res.body.services[0].nameAr).toBe('قص الشعر');
      // Service images are signed at read time too (audit D.1 twin fix).
      expect(mockStorage.getSignedUrl).toHaveBeenCalledWith('sawaa-media', 'org-1/svc.png', 300);
      expect(res.body.services[0].imageUrl).toBe(
        'https://signed.example.com/sawaa-media/org-1/svc.png?sig=test',
      );
      expect(res.body.services[0].showPrice).toBe(false);
      expect(res.body.services[0].showDuration).toBe(true);
      expect(res.body.services[0].hidePriceOnBooking).toBeUndefined();
      expect(res.body.services[0].hideDurationOnBooking).toBeUndefined();
      expect(res.body.vatRate).toBe(0.15);
    });

    it('leaves a null category imageUrl as null without signing', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([
        { id: 'cat-1', nameAr: 'شعر', isActive: true, imageUrl: null },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.organizationSettings.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(res.body.categories[0].imageUrl).toBeNull();
      expect(mockStorage.getSignedUrl).not.toHaveBeenCalled();
    });

    it('exposes the org vatRate from organizationSettings (fractional)', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);
      // Prisma returns Decimal for vatRate — anything with a toString() works.
      mockPrisma.organizationSettings.findFirst.mockResolvedValue({
        vatRate: { toString: () => '0.15' },
      });

      const res = await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(mockPrisma.organizationSettings.findFirst).toHaveBeenCalledWith({
        where: {},
        select: { vatRate: true },
      });
      expect(res.body.vatRate).toBe(0.15);
    });

    it('defaults vatRate to 0 when org settings are missing', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);
      mockPrisma.organizationSettings.findFirst.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(res.body.vatRate).toBe(0);
    });

    it('calls prisma with active + non-hidden filters', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, isVisible: true } }),
      );
      expect(mockPrisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, isHidden: false, archivedAt: null },
        }),
      );
    });

    it('uses an explicit public-safe select (not include) for services', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      const serviceArg = mockPrisma.service.findMany.mock.calls[0][0];

      // Projection must use `select`, never `include`.
      expect(serviceArg.select).toBeDefined();
      expect(serviceArg.include).toBeUndefined();

      // Public-safe fields are explicitly projected.
      expect(serviceArg.select).toEqual(
        expect.objectContaining({
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
        }),
      );

      // Relations are projected via nested select, not include.
      expect(serviceArg.select.durationOptions).toEqual(
        expect.objectContaining({
          where: { isActive: true, employeeServiceId: null },
          select: expect.objectContaining({
            id: true,
            label: true,
            durationMins: true,
            price: true,
            sortOrder: true,
          }),
        }),
      );
      expect(serviceArg.select.bookingConfigs).toEqual(
        expect.objectContaining({
          where: { isActive: true },
          select: expect.objectContaining({
            id: true,
            deliveryType: true,
            price: true,
            durationMins: true,
          }),
        }),
      );

      // Sensitive internal fields must NOT be exposed in the public shape.
      expect(serviceArg.select.isActive).toBeUndefined();
      expect(serviceArg.select.commissionRateOverride).toBeUndefined();
      expect(serviceArg.select.depositAmount).toBeUndefined();
    });
  });
});
