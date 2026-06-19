import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MobileClientAuthController } from './auth.controller';
import { RegisterMobileUserHandler } from '../../../modules/identity/register-mobile-user/register-mobile-user.handler';
import { RequestMobileLoginOtpHandler } from '../../../modules/identity/request-mobile-login-otp/request-mobile-login-otp.handler';
import { VerifyMobileOtpHandler } from '../../../modules/identity/verify-mobile-otp/verify-mobile-otp.handler';
import { RequestEmailVerificationHandler } from '../../../modules/identity/request-email-verification/request-email-verification.handler';
import { JwtGuard } from '../../../common/guards/jwt.guard';

describe('MobileClientAuthController (e2e)', () => {
  let app: INestApplication;

  const mockRegister = { execute: jest.fn() };
  const mockRequestLogin = { execute: jest.fn() };
  const mockVerifyOtp = { execute: jest.fn() };
  const mockRequestEmail = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [MobileClientAuthController],
      providers: [
        { provide: RegisterMobileUserHandler, useValue: mockRegister },
        { provide: RequestMobileLoginOtpHandler, useValue: mockRequestLogin },
        { provide: VerifyMobileOtpHandler, useValue: mockVerifyOtp },
        { provide: RequestEmailVerificationHandler, useValue: mockRequestEmail },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (ctx: any) => {
          ctx.switchToHttp().getRequest().user = { id: 'user-1' };
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

  describe('POST /mobile/auth/register', () => {
    const validRegister = {
      firstName: 'سارة',
      lastName: 'الأحمد',
      phone: '+966501234567',
      email: 'sara@example.com',
    };

    it('returns 200 on valid register', async () => {
      mockRegister.execute.mockResolvedValue({ userId: 'user-1', message: 'OTP sent' });

      const res = await request(app.getHttpServer())
        .post('/mobile/auth/register')
        .send(validRegister)
        .expect(200);

      expect(res.body.userId).toBe('user-1');
    });

    it('returns 400 for missing firstName', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/register')
        .send({ lastName: 'Test', phone: '+966501234567', email: 'test@example.com' })
        .expect(400);
    });

    it('returns 400 for invalid email', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/register')
        .send({ ...validRegister, email: 'not-an-email' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/register')
        .send({ ...validRegister, extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /mobile/auth/request-login-otp', () => {
    it('returns 200 on valid request', async () => {
      mockRequestLogin.execute.mockResolvedValue({ message: 'OTP sent' });

      const res = await request(app.getHttpServer())
        .post('/mobile/auth/request-login-otp')
        .send({ identifier: '+966501234567' })
        .expect(200);

      expect(res.body.message).toBe('OTP sent');
    });

    it('returns 400 for missing identifier', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/request-login-otp')
        .send({})
        .expect(400);
    });

    it('returns 400 for short identifier', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/request-login-otp')
        .send({ identifier: 'ab' })
        .expect(400);
    });
  });

  describe('POST /mobile/auth/verify-otp', () => {
    const validVerify = {
      identifier: '+966501234567',
      code: '1234',
      purpose: 'login',
    };

    it('returns 200 on valid verify', async () => {
      mockVerifyOtp.execute.mockResolvedValue({ token: 'jwt-token-123' });

      const res = await request(app.getHttpServer())
        .post('/mobile/auth/verify-otp')
        .send(validVerify)
        .expect(200);

      expect(res.body.token).toBe('jwt-token-123');
    });

    it('returns 400 for short code', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/verify-otp')
        .send({ ...validVerify, code: '12345' })
        .expect(400);
    });

    it('returns 400 for long code', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/verify-otp')
        .send({ ...validVerify, code: '1234567' })
        .expect(400);
    });

    it('returns 400 for invalid purpose', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/verify-otp')
        .send({ ...validVerify, purpose: 'forgot_password' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/mobile/auth/verify-otp')
        .send({ ...validVerify, extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /mobile/auth/request-email-verification', () => {
    it('returns 200 when authenticated', async () => {
      mockRequestEmail.execute.mockResolvedValue({ message: 'Email sent' });

      const res = await request(app.getHttpServer())
        .post('/mobile/auth/request-email-verification')
        .set('Authorization', 'Bearer fake-jwt')
        .expect(200);

      expect(res.body.message).toBe('Email sent');
      expect(mockRequestEmail.execute).toHaveBeenCalledWith({ userId: 'user-1' });
    });


  });
});
