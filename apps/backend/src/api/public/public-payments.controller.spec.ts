import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicPaymentsController } from './payments.controller';
import { InitGuestPaymentHandler } from '../../modules/finance/payments/public/init-guest-payment/init-guest-payment.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';

describe('PublicPaymentsController (e2e)', () => {
  let app: INestApplication;

  const mockInitGuestPayment = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicPaymentsController],
      providers: [
        { provide: InitGuestPaymentHandler, useValue: mockInitGuestPayment },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OtpSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.otpSession = {
            identifier: 'test@example.com',
            jti: 'jti-abc',
            exp: Math.floor(Date.now() / 1000) + 1800,
            channel: 'EMAIL',
            purpose: 'GUEST_BOOKING',
          };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
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
    it('returns 201 with payment init result', async () => {
      mockInitGuestPayment.execute.mockResolvedValue({
        paymentId: 'pay-1',
        redirectUrl: 'https://moyasar.com/pay/test',
      });

      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({ bookingId: '11111111-1111-4111-a111-111111111111' })
        .expect(201)
        .expect(({ body }) => {
          expect(body.paymentId).toBe('pay-1');
          expect(body.redirectUrl).toBe('https://moyasar.com/pay/test');
        });
    });

    it('returns 400 when bookingId is not UUID', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({ bookingId: 'not-a-uuid' })
        .expect(400);
    });

    it('returns 400 for unknown fields (whitelist)', async () => {
      return request(app.getHttpServer())
        .post('/public/payments/init')
        .set('Authorization', 'Bearer fake-otp-token')
        .send({ bookingId: '11111111-1111-4111-a111-111111111111', extra: 'bad' })
        .expect(400);
    });

    it('returns 403 without OTP session token', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [PublicPaymentsController],
        providers: [
          { provide: InitGuestPaymentHandler, useValue: mockInitGuestPayment },
        ],
      })
        .overrideGuard(JwtGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(OtpSessionGuard)
        .useValue({ canActivate: () => false })
        .compile();

      const guardedApp = moduleRef.createNestApplication();
      guardedApp.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      await guardedApp.init();

      await request(guardedApp.getHttpServer())
        .post('/public/payments/init')
        .send({ bookingId: '11111111-1111-4111-a111-111111111111' })
        .expect(403);

      await guardedApp.close();
    });
  });
});
