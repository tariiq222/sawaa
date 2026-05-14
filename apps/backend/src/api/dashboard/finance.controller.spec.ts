import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardFinanceController } from './finance.controller';
import { CreateInvoiceHandler } from '../../modules/finance/create-invoice/create-invoice.handler';
import { GetInvoiceHandler } from '../../modules/finance/get-invoice/get-invoice.handler';
import { ProcessPaymentHandler } from '../../modules/finance/process-payment/process-payment.handler';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { ApplyCouponHandler } from '../../modules/finance/apply-coupon/apply-coupon.handler';
import { ListCouponsHandler } from '../../modules/finance/coupons/list-coupons.handler';
import { GetCouponHandler } from '../../modules/finance/coupons/get-coupon.handler';
import { CreateCouponHandler } from '../../modules/finance/coupons/create-coupon.handler';
import { UpdateCouponHandler } from '../../modules/finance/coupons/update-coupon.handler';
import { DeleteCouponHandler } from '../../modules/finance/coupons/delete-coupon.handler';
import { GetPaymentStatsHandler } from '../../modules/finance/get-payment-stats/get-payment-stats.handler';
import { RefundPaymentHandler } from '../../modules/finance/refund-payment/refund-payment.handler';
import { VerifyPaymentHandler } from '../../modules/finance/verify-payment/verify-payment.handler';
import { BankTransferUploadHandler } from '../../modules/finance/bank-transfer-upload/bank-transfer-upload.handler';
import { GetMoyasarConfigHandler } from '../../modules/finance/moyasar-config/get-moyasar-config.handler';
import { UpsertMoyasarConfigHandler } from '../../modules/finance/moyasar-config/upsert-moyasar-config.handler';
import { TestMoyasarConfigHandler } from '../../modules/finance/moyasar-config/test-moyasar-config.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard } from '../../common/guards/casl.guard';

describe('DashboardFinanceController (e2e)', () => {
  let app: INestApplication;

  const mockCreateInvoice = { execute: jest.fn() };
  const mockGetInvoice = { execute: jest.fn() };
  const mockProcessPayment = { execute: jest.fn() };
  const mockListPayments = { execute: jest.fn() };
  const mockApplyCoupon = { execute: jest.fn() };
  const mockListCoupons = { execute: jest.fn() };
  const mockGetCoupon = { execute: jest.fn() };
  const mockCreateCoupon = { execute: jest.fn() };
  const mockUpdateCoupon = { execute: jest.fn() };
  const mockDeleteCoupon = { execute: jest.fn() };
  const mockGetPaymentStats = { execute: jest.fn() };
  const mockRefundPayment = { execute: jest.fn() };
  const mockVerifyPayment = { execute: jest.fn() };
  const mockBankTransferUpload = { execute: jest.fn() };
  const mockGetMoyasarConfig = { execute: jest.fn() };
  const mockUpsertMoyasarConfig = { execute: jest.fn() };
  const mockTestMoyasarConfig = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardFinanceController],
      providers: [
        { provide: CreateInvoiceHandler, useValue: mockCreateInvoice },
        { provide: GetInvoiceHandler, useValue: mockGetInvoice },
        { provide: ProcessPaymentHandler, useValue: mockProcessPayment },
        { provide: ListPaymentsHandler, useValue: mockListPayments },
        { provide: ApplyCouponHandler, useValue: mockApplyCoupon },
        { provide: ListCouponsHandler, useValue: mockListCoupons },
        { provide: GetCouponHandler, useValue: mockGetCoupon },
        { provide: CreateCouponHandler, useValue: mockCreateCoupon },
        { provide: UpdateCouponHandler, useValue: mockUpdateCoupon },
        { provide: DeleteCouponHandler, useValue: mockDeleteCoupon },
        { provide: GetPaymentStatsHandler, useValue: mockGetPaymentStats },
        { provide: RefundPaymentHandler, useValue: mockRefundPayment },
        { provide: VerifyPaymentHandler, useValue: mockVerifyPayment },
        { provide: BankTransferUploadHandler, useValue: mockBankTransferUpload },
        { provide: GetMoyasarConfigHandler, useValue: mockGetMoyasarConfig },
        { provide: UpsertMoyasarConfigHandler, useValue: mockUpsertMoyasarConfig },
        { provide: TestMoyasarConfigHandler, useValue: mockTestMoyasarConfig },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
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

  const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`;

  describe('POST /dashboard/finance/invoices', () => {
    it('returns 201 on valid invoice creation', async () => {
      mockCreateInvoice.execute.mockResolvedValue({ id: uuid(1), total: 115 });

      const res = await request(app.getHttpServer())
        .post('/dashboard/finance/invoices')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          bookingId: uuid(2),
          branchId: uuid(3),
          clientId: uuid(4),
          employeeId: uuid(5),
          subtotal: 100,
        })
        .expect(201);

      expect(res.body.id).toBe(uuid(1));
    });

    it('returns 400 for missing required fields', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/finance/invoices')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ subtotal: 100 })
        .expect(400);
    });

    it('returns 400 for negative subtotal', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/finance/invoices')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ bookingId: uuid(2), branchId: uuid(3), clientId: uuid(4), employeeId: uuid(5), subtotal: -10 })
        .expect(400);
    });
  });

  describe('GET /dashboard/finance/invoices/:id', () => {
    it('returns 200 with invoice details', async () => {
      mockGetInvoice.execute.mockResolvedValue({ id: uuid(1), total: 115 });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/finance/invoices/${uuid(1)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.total).toBe(115);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .get('/dashboard/finance/invoices/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('POST /dashboard/finance/payments', () => {
    it('returns 201 on valid payment', async () => {
      mockProcessPayment.execute.mockResolvedValue({ id: uuid(6), status: 'CAPTURED' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/finance/payments')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId: uuid(1), amount: 100, method: 'ONLINE_CARD' })
        .expect(201);

      expect(res.body.status).toBe('CAPTURED');
    });

    it('returns 400 for invalid method enum', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/finance/payments')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId: uuid(1), amount: 100, method: 'MADA' })
        .expect(400);
    });
  });

  describe('GET /dashboard/finance/payments', () => {
    it('returns 200 with payment list', async () => {
      mockListPayments.execute.mockResolvedValue({ data: [{ id: uuid(6) }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/finance/payments')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('GET /dashboard/finance/payments/stats', () => {
    it('returns 200 with payment stats', async () => {
      mockGetPaymentStats.execute.mockResolvedValue({ totalRevenue: 5000, totalRefunds: 200 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/finance/payments/stats')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.totalRevenue).toBe(5000);
    });
  });

  describe('PATCH /dashboard/finance/payments/:id/refund', () => {
    it('returns 200 on refund', async () => {
      mockRefundPayment.execute.mockResolvedValue({ id: uuid(6), status: 'REFUNDED' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/finance/payments/${uuid(6)}/refund`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ reason: 'Client request' })
        .expect(200);

      expect(res.body.status).toBe('REFUNDED');
    });
  });

  describe('PATCH /dashboard/finance/payments/:id/verify', () => {
    it('returns 200 on verify approve', async () => {
      mockVerifyPayment.execute.mockResolvedValue({ id: uuid(6), status: 'VERIFIED' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/finance/payments/${uuid(6)}/verify`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ action: 'approve' })
        .expect(200);

      expect(res.body.status).toBe('VERIFIED');
    });

    it('returns 400 for invalid action', async () => {
      return request(app.getHttpServer())
        .patch(`/dashboard/finance/payments/${uuid(6)}/verify`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ action: 'maybe' })
        .expect(400);
    });
  });

  describe('POST /dashboard/finance/coupons/apply', () => {
    it('returns 200 on apply coupon', async () => {
      mockApplyCoupon.execute.mockResolvedValue({ discount: 10, newTotal: 90 });

      const res = await request(app.getHttpServer())
        .post('/dashboard/finance/coupons/apply')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId: uuid(1), clientId: uuid(4), code: 'WELCOME10' })
        .expect(200);

      expect(res.body.discount).toBe(10);
    });

    it('returns 400 for short coupon code', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/finance/coupons/apply')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ invoiceId: uuid(1), clientId: uuid(4), code: 'AB' })
        .expect(400);
    });
  });

  describe('GET /dashboard/finance/coupons', () => {
    it('returns 200 with coupon list', async () => {
      mockListCoupons.execute.mockResolvedValue({ data: [{ id: uuid(7), code: 'WELCOME10' }], total: 1 });

      const res = await request(app.getHttpServer())
        .get('/dashboard/finance/coupons')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.data[0].code).toBe('WELCOME10');
    });
  });

  describe('GET /dashboard/finance/coupons/:id', () => {
    it('returns 200 with coupon details', async () => {
      mockGetCoupon.execute.mockResolvedValue({ id: uuid(7), code: 'WELCOME10' });

      const res = await request(app.getHttpServer())
        .get(`/dashboard/finance/coupons/${uuid(7)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.code).toBe('WELCOME10');
    });
  });

  describe('POST /dashboard/finance/coupons', () => {
    it('returns 201 on valid coupon creation', async () => {
      mockCreateCoupon.execute.mockResolvedValue({ id: uuid(7), code: 'SUMMER20' });

      const res = await request(app.getHttpServer())
        .post('/dashboard/finance/coupons')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ code: 'SUMMER20', discountType: 'PERCENTAGE', discountValue: 20 })
        .expect(201);

      expect(res.body.code).toBe('SUMMER20');
    });

    it('returns 400 for invalid discountType', async () => {
      return request(app.getHttpServer())
        .post('/dashboard/finance/coupons')
        .set('Authorization', 'Bearer fake-jwt')
        .send({ code: 'BAD', discountType: 'FREE', discountValue: 20 })
        .expect(400);
    });
  });

  describe('PATCH /dashboard/finance/coupons/:id', () => {
    it('returns 200 on update', async () => {
      mockUpdateCoupon.execute.mockResolvedValue({ id: uuid(7), code: 'SUMMER20' });

      const res = await request(app.getHttpServer())
        .patch(`/dashboard/finance/coupons/${uuid(7)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .send({ discountValue: 25 })
        .expect(200);

      expect(res.body.code).toBe('SUMMER20');
    });
  });

  describe('DELETE /dashboard/finance/coupons/:id', () => {
    it('returns 204 on delete', async () => {
      mockDeleteCoupon.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .delete(`/dashboard/finance/coupons/${uuid(7)}`)
        .set('Authorization', 'Bearer fake-jwt')
        .expect(204);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .delete('/dashboard/finance/coupons/not-a-uuid')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(400);
    });
  });

  describe('GET /dashboard/finance/moyasar/config', () => {
    it('returns 200 with config', async () => {
      mockGetMoyasarConfig.execute.mockResolvedValue({ publishableKey: 'pk_test_xxx', secretKey: '***' });

      const res = await request(app.getHttpServer())
        .get('/dashboard/finance/moyasar/config')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.publishableKey).toBe('pk_test_xxx');
    });
  });

  describe('PATCH /dashboard/finance/moyasar/config', () => {
    it('returns 200 on upsert', async () => {
      mockUpsertMoyasarConfig.execute.mockResolvedValue({ publishableKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx' });

      const res = await request(app.getHttpServer())
        .patch('/dashboard/finance/moyasar/config')
        .set('Authorization', 'Bearer fake-jwt')
        .send({
          publishableKey: 'pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          secretKey: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          webhookSecret: 'whsecxxxxxxxxxxxxxxxx',
          isLive: true,
        })
        .expect(200);

      expect(res.body.publishableKey).toBe('pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
    });
  });
});
