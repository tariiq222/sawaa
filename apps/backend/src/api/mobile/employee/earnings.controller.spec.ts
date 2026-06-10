import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { MobileEmployeeEarningsController } from './earnings.controller';
import { PrismaService } from '../../../infrastructure/database';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard } from '../../../common/guards/casl.guard';
import { GetEmployeeEarningsHandler } from '../../../modules/finance/get-employee-earnings/get-employee-earnings.handler';

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
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        GetEmployeeEarningsHandler,
      ],
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
    it('returns 200 with commission-based earnings summary (single method)', async () => {
      // Employee has 70% commission rate. The JWT carries sub = 'emp-1' (a User.id)
      // and no employeeId claim, so the controller resolves the real Employee.id
      // ('employee-1', deliberately different from sub) before querying invoices.
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'employee-1',
        commissionRate: new Prisma.Decimal('0.7'),
      });
      // Invoice subtotal = 10000 halalas, total = 11500 (incl. VAT), paid via ONLINE_CARD
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: 10000,
          total: 11500,
          bookingId: 'bk-1',
          payments: [{ amount: 11500, method: 'ONLINE_CARD' }],
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-1', serviceId: 'svc-1' }]);
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-1', commissionRateOverride: null }]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // Employee share = round(10000 * 0.7) = 7000 halalas
      expect(res.body.totalEarningsHalalas).toBe(7000);
      expect(res.body.totalRevenueHalalas).toBe(10000);
      expect(res.body.invoiceCount).toBe(1);
      // byMethod reflects employee share: proportion = 11500/11500 = 1 → 7000
      expect(res.body.byMethod).toEqual({ ONLINE_CARD: 7000 });
      // The invoice query must key on the RESOLVED Employee.id, not the JWT sub.
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ employeeId: 'employee-1' }),
        }),
      );
    });

    it('returns 200 with proportional byMethod when multiple payment methods used', async () => {
      // Employee has 80% commission rate
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'employee-1',
        commissionRate: new Prisma.Decimal('0.8'),
      });
      // Invoice subtotal = 20000 halalas, total = 23000 (incl. VAT)
      // Paid 50/50 between ONLINE_CARD and CASH
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: 20000,
          total: 23000,
          bookingId: 'bk-2',
          payments: [
            { amount: 11500, method: 'ONLINE_CARD' },
            { amount: 11500, method: 'CASH' },
          ],
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-2', serviceId: 'svc-2' }]);
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-2', commissionRateOverride: null }]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // Employee share = round(20000 * 0.8) = 16000 halalas
      expect(res.body.totalEarningsHalalas).toBe(16000);
      expect(res.body.totalRevenueHalalas).toBe(20000);
      // Each payment is 11500/23000 = 50% → employee share per method = round(16000 * 0.5) = 8000
      expect(res.body.byMethod.ONLINE_CARD).toBe(8000);
      expect(res.body.byMethod.CASH).toBe(8000);
    });

    it('applies per-service commission rate override when present', async () => {
      // Employee default rate = 0.5, but service override = 0.9
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'employee-1',
        commissionRate: new Prisma.Decimal('0.5'),
      });
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: 10000,
          total: 11500,
          bookingId: 'bk-3',
          payments: [{ amount: 11500, method: 'CASH' }],
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-3', serviceId: 'svc-3' }]);
      // Service has commissionRateOverride = 0.9
      mockPrisma.service.findMany.mockResolvedValue([
        { id: 'svc-3', commissionRateOverride: new Prisma.Decimal('0.9') },
      ]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // Employee share = round(10000 * 0.9) = 9000 halalas (override applied)
      expect(res.body.totalEarningsHalalas).toBe(9000);
      expect(res.body.byMethod).toEqual({ CASH: 9000 });
    });

    it('returns 200 with zero totals when no invoices', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'employee-1',
        commissionRate: new Prisma.Decimal('0.7'),
      });
      mockPrisma.invoice.findMany.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalEarningsHalalas).toBe(0);
      expect(res.body.totalRevenueHalalas).toBe(0);
      expect(res.body.invoiceCount).toBe(0);
      expect(res.body.byMethod).toEqual({});
    });

    it('defaults to 100% rate when employee row not found', async () => {
      // resolveEmployeeId succeeds (1st findFirst → resolved id), but the commission
      // lookup (2nd findFirst → null) misses, so the controller falls back to 1.0.
      mockPrisma.employee.findFirst
        .mockResolvedValueOnce({ id: 'employee-1' })
        .mockResolvedValue(null);
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          subtotal: 5000,
          total: 5750,
          bookingId: 'bk-4',
          payments: [{ amount: 5750, method: 'ONLINE_CARD' }],
        },
      ]);
      mockPrisma.booking.findMany.mockResolvedValue([{ id: 'bk-4', serviceId: 'svc-4' }]);
      mockPrisma.service.findMany.mockResolvedValue([{ id: 'svc-4', commissionRateOverride: null }]);

      const res = await request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=2026-01-01&to=2026-01-31')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      // Default rate = 1.0 → employee share = 5000 (all of subtotal)
      expect(res.body.totalEarningsHalalas).toBe(5000);
    });

    it('returns 400 for invalid date', async () => {
      return request(app.getHttpServer())
        .get('/mobile/employee/earnings?from=not-a-date')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });
});
