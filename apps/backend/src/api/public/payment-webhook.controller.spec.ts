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

    it('returns 400 for missing signature header', async () => {
      const res = await request(app.getHttpServer())
        .post('/public/payments/webhook')
        .send({ id: 'pay_abc123', status: 'paid', amount: 10000, currency: 'SAR' })
        .expect(400);

      expect(res.body.message).toBe('Missing X-Moyasar-Signature header');
    });

    it('returns 400 for invalid status', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({ id: 'pay_abc123', status: 'invalid_status', amount: 10000, currency: 'SAR' })
        .expect(400);
    });

    it('returns 400 for invalid currency', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({ id: 'pay_abc123', status: 'paid', amount: 10000, currency: 'USD' })
        .expect(400);
    });

    it('returns 400 for missing amount', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({ id: 'pay_abc123', status: 'paid', currency: 'SAR' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/webhook')
        .set('X-Moyasar-Signature', 'sig')
        .send({
          id: 'pay_abc123',
          status: 'paid',
          amount: 10000,
          currency: 'SAR',
          extra: 'bad',
        })
        .expect(400);
    });
  });
});
