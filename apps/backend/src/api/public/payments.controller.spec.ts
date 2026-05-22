import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicPaymentsController } from './payments.controller';
import { InitGuestPaymentHandler } from '../../modules/finance/payments/public/init-guest-payment/init-guest-payment.handler';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';

describe('PublicPaymentsController (e2e)', () => {
  let app: INestApplication;

  const mockInitPayment = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPaymentsController],
      providers: [
        { provide: InitGuestPaymentHandler, useValue: mockInitPayment },
      ],
    })
      .overrideGuard(OtpSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.otpSession = { identifier: '+966500000000', jti: 'jti-test', purpose: 'GUEST_BOOKING', channel: 'SMS', organizationId: null };
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
    it('returns 201 on valid init payment', async () => {
      mockInitPayment.execute.mockResolvedValue({
        paymentId: 'pay-1',
        redirectUrl: 'https://pay.example.com',
      });

      const res = await request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({ bookingId: '00000000-0000-4000-a000-000000000001' })
        .expect(201);

      expect(res.body.paymentId).toBe('pay-1');
      expect(mockInitPayment.execute).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: '00000000-0000-4000-a000-000000000001' }),
      );
    });

    it('returns 400 for missing bookingId', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({})
        .expect(400);
    });

    it('returns 400 for invalid UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({ bookingId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-session')
        .send({ bookingId: '00000000-0000-4000-a000-000000000001', extra: 'bad' })
        .expect(400);
    });
  });
});
