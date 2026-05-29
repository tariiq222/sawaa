import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PublicCatalogController } from './catalog.controller';
import { PrismaService } from '../../infrastructure/database';

describe('PublicCatalogController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    department: { findMany: jest.fn() },
    serviceCategory: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicCatalogController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
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
        { id: 'cat-1', nameAr: 'شعر', isActive: true },
      ]);
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'svc-1', nameAr: 'قص الشعر', isActive: true, durationOptions: [{ id: 'do-1', durationMins: 30, price: 50 }] },
      ]);

      const res = await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(res.body.departments).toHaveLength(1);
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.services).toHaveLength(1);
      expect(res.body.services[0].nameAr).toBe('قص الشعر');
    });

    it('calls prisma with active + non-hidden filters', async () => {
      mockPrisma.department.findMany.mockResolvedValue([]);
      mockPrisma.serviceCategory.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/public/services')
        .expect(200);

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
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
          isActive: true,
          iconName: true,
          iconBgColor: true,
          hidePriceOnBooking: true,
          hideDurationOnBooking: true,
          minParticipants: true,
        }),
      );

      // Relations are projected via nested select, not include.
      expect(serviceArg.select.durationOptions).toEqual(
        expect.objectContaining({
          where: { isActive: true },
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

      // Sensitive internal fields must NOT be exposed.
      expect(serviceArg.select.commissionRateOverride).toBeUndefined();
      expect(serviceArg.select.depositAmount).toBeUndefined();
    });
  });
});
