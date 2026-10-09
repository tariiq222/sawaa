import { INestApplication, HttpException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import 'reflect-metadata';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { MobileClientEmailController, ClientEmailValidationFilter } from './client-email.controller';
import { GetClientEmailStatusHandler } from '../../../modules/identity/client-email/get-client-email-status.handler';
import { RequestClientEmailHandler } from '../../../modules/identity/client-email/request-client-email.handler';
import { VerifyClientEmailHandler } from '../../../modules/identity/client-email/verify-client-email.handler';
import { DeclineClientEmailHandler } from '../../../modules/identity/client-email/decline-client-email.handler';
import { RequestClientEmailDto, VerifyClientEmailDto } from '../../../modules/identity/client-email/client-email.dto';

const challengeId = 'b93b1499-dd38-4f61-97bc-e1bd0053903e';

describe('client-email validation error envelope', () => {
  it.each([
    [503, { code: 'delivery_unavailable', message: 'secret provider detail' }, 'delivery_unavailable'],
    [429, { code: 'send_limited', retryAfterSeconds: 60 }, 'send_limited'],
    [400, { code: 'email_unchanged', message: 'raw sensitive error' }, 'email_unchanged'],
    [400, { message: 'raw sensitive error' }, 'invalid_or_expired_code'],
    [409, {}, 'invalid_or_expired_code'],
    [503, 'raw sensitive error', 'delivery_unavailable'],
  ])('sanitizes HTTP %s errors while retaining safe contract codes', (status, body, code) => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new ClientEmailValidationFilter().catch(new HttpException(body, status), host);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: status, code, message: code }));
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('sensitive');
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret');
  });
  it('exposes invalid_email as a top-level code for global DTO validation failures', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new ClientEmailValidationFilter().catch(new HttpException({ message: ['invalid_email'] }, 400), host);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'invalid_email', message: 'invalid_email' }));
  });
  it('carries a non-negative retryAfterSeconds when the limiter provides one', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new ClientEmailValidationFilter().catch(new HttpException({ code: 'send_limited', retryAfterSeconds: 42 }, 429), host);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'send_limited', retryAfterSeconds: 42 }));
  });
});

describe('client-email controller wiring', () => {
  const methods = ['status', 'request', 'verify', 'decline'] as const;
  it.each(methods)('serves %s with no-store', method => {
    const handler = MobileClientEmailController.prototype[method];
    expect(Reflect.getMetadata('__headers__', handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
  });
  it('guards the whole controller with ClientSessionGuard', () => {
    expect(Reflect.getMetadata('__guards__', MobileClientEmailController)).toContainEqual(ClientSessionGuard);
  });
  it.each([['request', 3], ['verify', 10], ['decline', 10]] as const)('throttles %s at %d/min', (method, limit) => {
    const handler = MobileClientEmailController.prototype[method];
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('__httpCode__', handler)).toBe(200);
  });
});

describe('client-email controller delegation (e2e)', () => {
  let app: INestApplication;
  const mockStatus = { execute: jest.fn() };
  const mockRequest = { execute: jest.fn() };
  const mockVerify = { execute: jest.fn() };
  const mockDecline = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MobileClientEmailController],
      providers: [
        { provide: GetClientEmailStatusHandler, useValue: mockStatus },
        { provide: RequestClientEmailHandler, useValue: mockRequest },
        { provide: VerifyClientEmailHandler, useValue: mockVerify },
        { provide: DeclineClientEmailHandler, useValue: mockDecline },
      ],
    })
      .overrideGuard(ClientSessionGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'client-1' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.clearAllMocks(); });

  it('GET /mobile/client/profile/email delegates with the session client id', async () => {
    mockStatus.execute.mockResolvedValue({ status: 'unverified', email: null, pendingEmail: null, prompt: true });
    const res = await request(app.getHttpServer()).get('/mobile/client/profile/email').expect(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body).toEqual({ status: 'unverified', email: null, pendingEmail: null, prompt: true });
    expect(mockStatus.execute).toHaveBeenCalledWith('client-1');
  });

  it('POST request delegates the normalized email with the session client id', async () => {
    mockRequest.execute.mockResolvedValue({ challengeId, maskedEmail: 'p***@example.test', expiresIn: 300, retryAfterSeconds: 60 });
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/email/request').send({ email: ' Person@Example.Test ' }).expect(200);
    expect(res.body.challengeId).toBe(challengeId);
    expect(mockRequest.execute).toHaveBeenCalledWith('client-1', { email: 'person@example.test' });
  });

  it('POST verify delegates the challenge and code', async () => {
    mockVerify.execute.mockResolvedValue({ status: 'verified', email: 'person@example.test', pendingEmail: null, prompt: false });
    await request(app.getHttpServer()).post('/mobile/client/profile/email/verify').send({ challengeId, code: '012345' }).expect(200);
    expect(mockVerify.execute).toHaveBeenCalledWith('client-1', { challengeId, code: '012345' });
  });

  it('POST decline delegates with the session client id only', async () => {
    mockDecline.execute.mockResolvedValue({ status: 'none', email: null, pendingEmail: null, prompt: false });
    await request(app.getHttpServer()).post('/mobile/client/profile/email/decline').expect(200);
    expect(mockDecline.execute).toHaveBeenCalledWith('client-1');
  });

  it('rejects a non-six-digit code and injected identity fields', async () => {
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/email/verify').send({ challengeId, code: '12345', clientId: 'victim' }).expect(400);
    expect(JSON.stringify(res.body)).not.toContain('victim');
    expect(mockVerify.execute).not.toHaveBeenCalled();
  });
});

describe('client-email HTTP input contract', () => {
  it('normalizes email with the shared identifier policy', async () => {
    const dto = plainToInstance(RequestClientEmailDto, { email: ' Person@Example.Test ' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.email).toBe('person@example.test');
  });
  it('rejects invalid emails', async () => {
    expect((await validate(plainToInstance(RequestClientEmailDto, { email: 'not-an-email' }))).map(error => error.property)).toContain('email');
  });
  it.each(['1234', '12345x', '1234567', 123456])('rejects invalid code %s', async code => {
    const dto = plainToInstance(VerifyClientEmailDto, { challengeId, code });
    expect((await validate(dto)).some(error => error.property === 'code')).toBe(true);
  });
  it('rejects non-UUID challenges and injected identity fields', async () => {
    const dto = plainToInstance(VerifyClientEmailDto, { challengeId: 'not-uuid', code: '123456', clientId: 'victim', userId: 'victim', role: 'ADMIN' });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.map(error => error.property)).toEqual(expect.arrayContaining(['challengeId', 'clientId', 'userId', 'role']));
  });
});
