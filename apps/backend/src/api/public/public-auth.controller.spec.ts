import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PublicAuthController } from './public-auth.controller';
import { RegisterHandler } from '../../modules/identity/client-auth/register.handler';
import { ClientLoginHandler } from '../../modules/identity/client-auth/client-login.handler';
import { ClientRefreshHandler } from '../../modules/identity/client-auth/client-refresh.handler';
import { ClientLogoutHandler } from '../../modules/identity/client-auth/client-logout.handler';
import { ResetPasswordHandler } from '../../modules/identity/client-auth/reset-password/reset-password.handler';
import { JwtGuard } from '../../common/guards/jwt.guard';
import cookieParser from 'cookie-parser';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';

describe('PublicAuthController (e2e)', () => {
  let app: INestApplication;

  const mockRegister = { execute: jest.fn() };
  const mockLogin = { execute: jest.fn() };
  const mockRefresh = { execute: jest.fn() };
  const mockLogout = { execute: jest.fn() };
  const mockResetPassword = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PublicAuthController],
      providers: [
        { provide: RegisterHandler, useValue: mockRegister },
        { provide: ClientLoginHandler, useValue: mockLogin },
        { provide: ClientRefreshHandler, useValue: mockRefresh },
        { provide: ClientLogoutHandler, useValue: mockLogout },
        { provide: ResetPasswordHandler, useValue: mockResetPassword },
      ],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1', email: 'test@example.com', phone: '+966501234567' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
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

  describe('POST /public/auth/register', () => {
    it('returns 200 with clientId on valid payload', async () => {
      mockRegister.execute.mockResolvedValue({
        accessToken: 'acc-token',
        refreshToken: 'ref-token',
        accessMaxAgeMs: 900000,
        refreshMaxAgeMs: 2592000000,
        clientId: 'client-1',
      });

      return request(app.getHttpServer())
        .post('/public/auth/register')
        .send({ password: 'SecurePass123', name: 'Test User' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.clientId).toBe('client-1');
        });
    });

    it('returns 400 when password is too short', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/register')
        .send({ password: 'short', name: 'Test' })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toEqual(
            expect.arrayContaining([
              expect.stringMatching(/password must be at least 8/i),
            ]),
          );
        });
    });

    it('returns 400 when password lacks uppercase', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/register')
        .send({ password: 'lowercase1', name: 'Test' })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toEqual(
            expect.arrayContaining([
              expect.stringMatching(/uppercase/i),
            ]),
          );
        });
    });

    it('returns 400 when password lacks digit', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/register')
        .send({ password: 'NoDigitsHere', name: 'Test' })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toEqual(
            expect.arrayContaining([
              expect.stringMatching(/digit/i),
            ]),
          );
        });
    });

    it('returns 400 for unknown fields (whitelist)', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/register')
        .send({ password: 'SecurePass123', name: 'Test', extraField: 'bad' })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toEqual(
            expect.arrayContaining([expect.stringMatching(/property.*extraField.*should not exist/i)]),
          );
        });
    });
  });

  describe('POST /public/auth/login', () => {
    it('returns 200 with clientId on valid credentials', async () => {
      mockLogin.execute.mockResolvedValue({
        accessToken: 'acc-token',
        refreshToken: 'ref-token',
        accessMaxAgeMs: 900000,
        refreshMaxAgeMs: 2592000000,
        clientId: 'client-1',
      });

      return request(app.getHttpServer())
        .post('/public/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123' })
        .expect(200)
        .expect(({ body }) => {
          expect(body.clientId).toBe('client-1');
        });
    });

    it('returns 400 for invalid email format', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/login')
        .send({ email: 'not-an-email', password: 'SecurePass123' })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toEqual(
            expect.arrayContaining([expect.stringMatching(/email/i)]),
          );
        });
    });

    it('returns 400 for short password', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/login')
        .send({ email: 'test@example.com', password: 'short' })
        .expect(400)
        .expect(({ body }) => {
          expect(body.message).toEqual(
            expect.arrayContaining([expect.stringMatching(/password must be longer/i)]),
          );
        });
    });
  });

  describe('POST /public/auth/refresh', () => {
    it('returns 200 with clientId', async () => {
      mockRefresh.execute.mockResolvedValue({
        accessToken: 'new-acc-token',
        refreshToken: 'new-ref-token',
        accessMaxAgeMs: 900000,
        refreshMaxAgeMs: 2592000000,
      });

      return request(app.getHttpServer())
        .post('/public/auth/refresh')
        .set('Cookie', 'client_refresh_token=valid-refresh-token')
        .send({})
        .expect(200)
        .expect(({ body }) => {
          expect(body.clientId).toBe('client-1');
        });
    });

    it('returns 401 when refreshToken cookie is missing', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/refresh')
        .send({})
        .expect(401);
    });
  });

  describe('POST /public/auth/logout', () => {
    it('returns 204 on valid logout', async () => {
      mockLogout.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .post('/public/auth/logout')
        .send({ refreshToken: 'valid-token' })
        .expect(204);
    });

    it('returns 204 when refreshToken is empty', async () => {
      return request(app.getHttpServer())
        .post('/public/auth/logout')
        .send({ refreshToken: '' })
        .expect(204);
    });
  });

  describe('POST /public/auth/reset-password', () => {
    it('returns 204 on valid request', async () => {
      mockResetPassword.execute.mockResolvedValue(undefined);

      return request(app.getHttpServer())
        .post('/public/auth/reset-password')
        .send({ sessionToken: 'reset-token', newPassword: 'SecurePass123' })
        .expect(204);
    });
  });
});
