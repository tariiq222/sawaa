import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicPaymentsController } from './payments.controller';
import { InitClientPaymentHandler } from '../../modules/finance/payments/client/init-client-payment/init-client-payment.handler';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicPaymentsController (e2e)', () => {
  let app: INestApplication;

  const mockInitPayment = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPaymentsController],
      providers: [
        { provide: InitClientPaymentHandler, useValue: mockInitPayment },
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
});
