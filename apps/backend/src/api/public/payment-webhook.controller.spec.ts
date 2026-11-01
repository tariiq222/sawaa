import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicPaymentWebhookController } from './payment-webhook.controller';
import { MoyasarWebhookHandler } from '../../modules/finance/moyasar-webhook/moyasar-webhook.handler';

describe('PublicPaymentWebhookController (e2e)', () => {
  let app: INestApplication;

  const mockHandler = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPaymentWebhookController],
      providers: [
        { provide: MoyasarWebhookHandler, useValue: mockHandler },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
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

  describe('POST /public/payments/webhook', () => {
    it('returns 200 on valid webhook', async () => {
      mockHandler.execute.mockResolvedValue({ received: true });

      const res = await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'valid-signature')
        .send({
          id: 'pay_abc123',
          status: 'paid',
          amount: 10000,
          currency: 'SAR',
          metadata: { invoiceId: '00000000-0000-4000-a000-000000000001' },
        })
        .expect(200);

      expect(res.body.received).toBe(true);
      expect(mockHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'pay_abc123', status: 'paid' }),
          rawBody: expect.any(String),
          signature: 'valid-signature',
        }),
      );
    });

    it('acks with 200 for missing signature header', async () => {
      mockHandler.execute.mockResolvedValue({ received: true });

      await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .send({ id: 'pay_abc123', status: 'paid', amount: 10000, currency: 'SAR' })
        .expect(200);
    });

    // PAY-02: every 4xx makes the provider retry forever, so an unknown or
    // future status must reach the handler (which decides from the authoritative
    // provider fetch) instead of being rejected by the validation pipe.
    it('acks an out-of-enum provider status instead of returning 400', async () => {
      mockHandler.execute.mockResolvedValue({ received: true });

      await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({ id: 'pay_abc123', status: 'initiated', amount: 10000, currency: 'SAR' })
        .expect(200);

      expect(mockHandler.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ status: 'initiated' }),
        }),
      );
    });

    it('acks a non-SAR currency instead of returning 400', async () => {
      mockHandler.execute.mockResolvedValue({ received: true });

      await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({ id: 'pay_abc123', status: 'paid', amount: 10000, currency: 'USD' })
        .expect(200);
    });

    it('acks with 200 for missing amount', async () => {
      mockHandler.execute.mockResolvedValue({ received: true });

      await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({ id: 'pay_abc123', status: 'paid', currency: 'SAR' })
        .expect(200);
    });

    it('acks unknown provider fields instead of returning 400', async () => {
      mockHandler.execute.mockResolvedValue({ received: true });

      await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({
          id: 'pay_abc123',
          status: 'paid',
          amount: 10000,
          currency: 'SAR',
          source: { type: 'creditcard', company: 'visa' },
          new_provider_field: 'whatever',
        })
        .expect(200);
    });
  });
});
