import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicOtpController } from './otp.controller';
import { RequestOtpHandler } from '../../modules/identity/otp/request-otp.handler';
import { VerifyOtpHandler } from '../../modules/identity/otp/verify-otp.handler';

describe('PublicOtpController (e2e)', () => {
  let app: INestApplication;

  const mockRequest = { execute: jest.fn() };
  const mockVerify = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicOtpController],
      providers: [
        { provide: RequestOtpHandler, useValue: mockRequest },
        { provide: VerifyOtpHandler, useValue: mockVerify },
      ],
    }).compile();

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

  const validRequest = {
    channel: 'EMAIL',
    identifier: 'user@example.com',
    purpose: 'GUEST_BOOKING',
  };

  describe('POST /public/otp/request', () => {
    it('returns 200 on valid request', async () => {
      mockRequest.execute.mockResolvedValue({ message: 'OTP sent' });

      const res = await request(app.getHttpServer())
        .post('/public/otp/request')
        .send(validRequest)
        .expect(200);

      expect(res.body.message).toBe('OTP sent');
    });

    it('returns 400 for missing channel', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/request')
        .send({ identifier: 'user@example.com', purpose: 'GUEST_BOOKING' })
        .expect(400);
    });

    it('returns 400 for invalid channel', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/request')
        .send({ ...validRequest, channel: 'WHATSAPP' })
        .expect(400);
    });

    it('returns 400 for missing identifier', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/request')
        .send({ channel: 'EMAIL', purpose: 'GUEST_BOOKING' })
        .expect(400);
    });

    it('returns 400 for invalid purpose', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/request')
        .send({ ...validRequest, purpose: 'INVALID' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/request')
        .send({ ...validRequest, extra: 'bad' })
        .expect(400);
    });
  });

  describe('POST /public/otp/verify', () => {
    const validVerify = {
      channel: 'EMAIL',
      identifier: 'user@example.com',
      code: '123456',
      purpose: 'GUEST_BOOKING',
    };

    it('returns 200 on valid verify', async () => {
      mockVerify.execute.mockResolvedValue({ token: 'session-token-123' });

      const res = await request(app.getHttpServer())
        .post('/public/otp/verify')
        .send(validVerify)
        .expect(200);

      expect(res.body.token).toBe('session-token-123');
    });

    it('returns 400 for short code', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/verify')
        .send({ ...validVerify, code: '12345' })
        .expect(400);
    });

    it('returns 400 for long code', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/verify')
        .send({ ...validVerify, code: '1234567' })
        .expect(400);
    });

    it('returns 400 for missing code', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/verify')
        .send({ channel: 'EMAIL', identifier: 'user@example.com', purpose: 'GUEST_BOOKING' })
        .expect(400);
    });

    it('returns 400 for unknown fields', async () => {
      return request(app.getHttpServer())
        .post('/public/otp/verify')
        .send({ ...validVerify, extra: 'bad' })
        .expect(400);
    });
  });
});
