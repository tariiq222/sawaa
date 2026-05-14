import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicVerifyEmailController } from './verify-email.controller';
import { VerifyEmailHandler } from '../../modules/identity/verify-email/verify-email.handler';

describe('PublicVerifyEmailController (e2e)', () => {
  let app: INestApplication;

  const mockVerifyEmail = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicVerifyEmailController],
      providers: [
        { provide: VerifyEmailHandler, useValue: mockVerifyEmail },
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

  describe('GET /public/verify-email', () => {
    it('returns 200 with verification result', async () => {
      mockVerifyEmail.execute.mockResolvedValue({ verified: true, email: 'user@example.com' });

      const res = await request(app.getHttpServer())
        .get('/public/verify-email')
        .query({ token: 'valid-token-123' })
        .expect(200);

      expect(res.body.verified).toBe(true);
      expect(mockVerifyEmail.execute).toHaveBeenCalledWith({ token: 'valid-token-123' });
    });

    it('passes token query param to handler', async () => {
      mockVerifyEmail.execute.mockResolvedValue({ verified: false });

      await request(app.getHttpServer())
        .get('/public/verify-email')
        .query({ token: 'expired-token' })
        .expect(200);

      expect(mockVerifyEmail.execute).toHaveBeenCalledWith({ token: 'expired-token' });
    });
  });
});
