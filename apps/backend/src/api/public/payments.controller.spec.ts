import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicPaymentsController } from './payments.controller';
import { InitClientPaymentHandler } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { InitPackagePurchaseHandler } from '../../modules/finance/package-purchases/init-package-purchase/init-package-purchase.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicPaymentsController (e2e)', () => {
  let app: INestApplication;

  const mockInitPayment = { execute: jest.fn() };
  const mockInitPackagePurchase = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPaymentsController],
      providers: [
        { provide: InitClientPaymentHandler, useValue: mockInitPayment },
        { provide: InitPackagePurchaseHandler, useValue: mockInitPackagePurchase },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', email: 'client@example.com', phone: '+966500000000' };
          return true;
        },
      })
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

  describe('POST /public/payments/init', () => {
    it('returns 201 and binds the session clientId to the invoice', async () => {
      mockInitPayment.execute.mockResolvedValue({
        paymentId: 'pay-1',
        redirectUrl: 'https://pay.example.com',
      });

      const res = await request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ invoiceId: '00000000-0000-4000-a000-000000000001' })
        .expect(201);

      expect(res.body.paymentId).toBe('pay-1');
      // clientId MUST come from the session, never the request body.
      expect(mockInitPayment.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: '00000000-0000-4000-a000-000000000001',
          clientId: 'client-1',
        }),
      );
    });

    it('returns 400 for missing invoiceId', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ invoiceId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ invoiceId: '00000000-0000-4000-a000-000000000001', extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /public/payments/package-purchases/init', () => {
    const validBody = {
      packageId: '00000000-0000-4000-a000-000000000001',
      branchId: '00000000-0000-4000-a000-000000000002',
    };

    it('returns 201 and binds the session clientId (never the body) to the purchase', async () => {
      mockInitPackagePurchase.execute.mockResolvedValue({
        purchaseId: 'purchase-1',
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
        redirectUrl: 'https://checkout.moyasar.com/pay/abc',
      });

      const res = await request(app.getHttpServer())
        .post('/public/payments/package-purchases/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send(validBody)
        .expect(201);

      expect(res.body.redirectUrl).toBe('https://checkout.moyasar.com/pay/abc');
      expect(mockInitPackagePurchase.execute).toHaveBeenCalledWith({
        clientId: 'client-1',
        packageId: validBody.packageId,
        branchId: validBody.branchId,
      });
    });

    it('ignores a caller-supplied clientId (cannot purchase on behalf of another client)', async () => {
      mockInitPackagePurchase.execute.mockResolvedValue({
        purchaseId: 'purchase-1',
        invoiceId: 'inv-1',
        paymentId: 'pay-1',
        redirectUrl: 'https://x',
      });

      await request(app.getHttpServer())
        .post('/public/payments/package-purchases/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ ...validBody, clientId: 'attacker-victim-id' })
        .expect(400); // forbidNonWhitelisted strips/rejects clientId in the body
    });

    it('returns 400 for a missing packageId', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/package-purchases/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ branchId: validBody.branchId })
        .expect(400);
    });

    it('returns 400 for an invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/package-purchases/init')
        .set('Authorization', 'Bearer fake-client-session')
        .send({ packageId: 'not-a-uuid', branchId: validBody.branchId })
        .expect(400);
    });
  });
});
