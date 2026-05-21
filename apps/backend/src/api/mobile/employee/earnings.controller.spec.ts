import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileEmployeeEarningsController } from './earnings.controller';
import { PrismaService } from '../../../infrastructure/database';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';
import { Prisma } from '@prisma/client';

describe('MobileEmployeeEarningsController (e2e)', () => {
  let app: INestApplication;

  const mockPrisma = {
    employee: {
      findFirst: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
    },
    booking: {
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileEmployeeEarningsController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = {
            sub: 'emp-1',
            id: 'emp-1',
            email: 'emp@example.com',
            role: 'EMPLOYEE',
            isSuperAdmin: false,
          };
          return true;
        },
      })
      .overrideGuard(CaslGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /mobile/employee/earnings', () => {
    it('returns correct employee commission share (70% rate, no override)', async () => {
      // Employee has 70% commission rate
      mockPrisma.employee.findFirst.mockResolvedValue({
        commissionRate: new Prisma.Decimal('0.70'),
      });

      // One invoice: subtotal=13000 halalas, total=14950 (incl. 15% VAT)
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: new Prisma.Decimal('13000'),
          total: new Prisma.Decimal('14950'),
          bookingId: 'booking-1',
          payments: [
            { amount: new Prisma.Decimal('14950'), method: 'ONLINE_CARD' },
          ],
        },
      ]);

      // Booking links to service-1
      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'booking-1', serviceId: 'service-1' },
      ]);

      // Service has no commission override
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'service-1', commissionRateOverride: null },
      ]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // 13000 × 0.70 = 9100
      expect(res.body.totalEarningsHalalas).toBe(9100);
      expect(res.body.totalRevenueHalalas).toBe(13000);
      expect(res.body.invoiceCount).toBe(1);
      // byMethod reflects gross payment amounts
      expect(res.body.byMethod).toEqual({ ONLINE_CARD: 14950 });
    });

    it('applies service-level commission override (50% overrides 70%)', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        commissionRate: new Prisma.Decimal('0.70'),
      });

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: new Prisma.Decimal('10000'),
          total: new Prisma.Decimal('11500'),
          bookingId: 'booking-2',
          payments: [
            { amount: new Prisma.Decimal('11500'), method: 'CASH' },
          ],
        },
      ]);

      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'booking-2', serviceId: 'service-2' },
      ]);

      // This service overrides to 50%
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'service-2', commissionRateOverride: new Prisma.Decimal('0.50') },
      ]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // 10000 × 0.50 = 5000 (override wins)
      expect(res.body.totalEarningsHalalas).toBe(5000);
      expect(res.body.totalRevenueHalalas).toBe(10000);
    });

    it('returns 200 with all-zero totals when no invoices', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        commissionRate: new Prisma.Decimal('1.0'),
      });
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      // booking/service queries not called when no invoices with bookingIds
      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalEarningsHalalas).toBe(0);
      expect(res.body.totalRevenueHalalas).toBe(0);
      expect(res.body.invoiceCount).toBe(0);
    });

    it('falls back to 100% rate when employee record not found', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: new Prisma.Decimal('10000'),
          total: new Prisma.Decimal('11500'),
          bookingId: null, // bundle invoice — no booking
          payments: [
            { amount: new Prisma.Decimal('11500'), method: 'CASH' },
          ],
        },
      ]);

      mockPrisma.booking.findMany.mockResolvedValue([]);
      mockPrisma.service.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // 10000 × 1.0 = 10000 (full subtotal goes to employee as fallback)
      expect(res.body.totalEarningsHalalas).toBe(10000);
    });

    it('aggregates multiple invoices with mixed commission rates', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        commissionRate: new Prisma.Decimal('0.70'),
      });

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: new Prisma.Decimal('10000'),
          total: new Prisma.Decimal('11500'),
          bookingId: 'booking-a',
          payments: [{ amount: new Prisma.Decimal('11500'), method: 'ONLINE_CARD' }],
        },
        {
          subtotal: new Prisma.Decimal('5000'),
          total: new Prisma.Decimal('5750'),
          bookingId: 'booking-b',
          payments: [{ amount: new Prisma.Decimal('5750'), method: 'CASH' }],
        },
      ]);

      mockPrisma.booking.findMany.mockResolvedValue([
        { id: 'booking-a', serviceId: 'service-a' },
        { id: 'booking-b', serviceId: 'service-b' },
      ]);

      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'service-a', commissionRateOverride: null },          // uses 70%
        { id: 'service-b', commissionRateOverride: new Prisma.Decimal('1.0') }, // 100%
      ]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // booking-a: 10000 × 0.70 = 7000
      // booking-b: 5000 × 1.0  = 5000
      // total = 12000
      expect(res.body.totalEarningsHalalas).toBe(12000);
      expect(res.body.totalRevenueHalalas).toBe(15000);
      expect(res.body.invoiceCount).toBe(2);
      expect(res.body.byMethod).toEqual({ ONLINE_CARD: 11500, CASH: 5750 });
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=not-a-date')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
