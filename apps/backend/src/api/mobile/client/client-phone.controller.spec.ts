import { INestApplication, HttpException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import 'reflect-metadata';
import { ClientSessionGuard } from '../../../common/guards/client-session.guard';
import { MobileClientPhoneController, ClientPhoneValidationFilter } from './client-phone.controller';
import { RequestClientPhoneHandler } from '../../../modules/identity/client-phone/request-client-phone.handler';
import { VerifyClientPhoneHandler } from '../../../modules/identity/client-phone/verify-client-phone.handler';

const challengeId = 'b93b1499-dd38-4f61-97bc-e1bd0053903e';

describe('client-phone validation error envelope', () => {
  it.each([
    [503, { code: 'delivery_unavailable', message: 'secret provider detail' }, 'delivery_unavailable'],
    [429, { code: 'send_limited', retryAfterSeconds: 60 }, 'send_limited'],
    [400, { code: 'phone_unchanged', message: 'raw sensitive error' }, 'phone_unchanged'],
    [400, { message: ['invalid_phone'] }, 'invalid_phone'],
    [409, { code: 'details_unavailable', phone: '+966512345678' }, 'details_unavailable'],
    [400, { message: 'raw sensitive error' }, 'invalid_or_expired_code'],
    [503, 'raw sensitive error', 'delivery_unavailable'],
  ])('sanitizes HTTP %s errors', (status, body, code) => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new ClientPhoneValidationFilter().catch(new HttpException(body, status), host);
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: status, code, message: code }));
    expect(JSON.stringify(response.json.mock.calls)).not.toMatch(/sensitive|secret|966512345678/);
  });
  it.each([42, -1, Infinity, '60'])('only carries finite non-negative numeric retry delays: %s', retryAfterSeconds => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() };
    const host = { switchToHttp: () => ({ getResponse: () => response }) } as never;
    new ClientPhoneValidationFilter().catch(new HttpException({ code: 'send_limited', retryAfterSeconds }, 429), host);
    expect(response.json).toHaveBeenCalledWith({ statusCode: 429, code: 'send_limited', message: 'send_limited', ...(retryAfterSeconds === 42 ? { retryAfterSeconds: 42 } : {}) });
  });
});

describe('client-phone controller wiring', () => {
  it('guards the whole controller with ClientSessionGuard and bypasses staff JWT auth', () => {
    expect(Reflect.getMetadata('__guards__', MobileClientPhoneController)).toContainEqual(ClientSessionGuard);
    expect(Reflect.getMetadata('isPublic', MobileClientPhoneController)).toBe(true);
  });
  it.each([['request', 3], ['verify', 10]] as const)('serves %s with no-store and %d/min throttle', (method, limit) => {
    const handler = MobileClientPhoneController.prototype[method];
    expect(Reflect.getMetadata('__headers__', handler)).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(60000);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('__httpCode__', handler)).toBe(200);
  });
});

describe('client-phone HTTP input and delegation', () => {
  let app: INestApplication;
  const mockRequest = { execute: jest.fn() };
  const mockVerify = { execute: jest.fn() };
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MobileClientPhoneController],
      providers: [
        { provide: RequestClientPhoneHandler, useValue: mockRequest },
        { provide: VerifyClientPhoneHandler, useValue: mockVerify },
      ],
    }).overrideGuard(ClientSessionGuard).useValue({
      canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
        ctx.switchToHttp().getRequest().user = { id: 'client-1' };
        return true;
      },
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  afterEach(() => { jest.clearAllMocks(); });
  it('delegates a normalized Saudi phone and session identity', async () => {
    mockRequest.execute.mockResolvedValue({ challengeId, maskedPhone: '+966***78', expiresIn: 300, retryAfterSeconds: 60 });
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/phone/request').send({ phone: '0512345678' }).expect(200);
    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body).toEqual({ challengeId, maskedPhone: '+966***78', expiresIn: 300, retryAfterSeconds: 60 });
    expect(mockRequest.execute).toHaveBeenCalledWith('client-1', { phone: '+966512345678' });
  });
  it.each(['+14155550100', '+966112345678', 'not-a-phone'])('rejects invalid or non-Saudi mobile phone %s', async phone => {
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/phone/request').send({ phone }).expect(400);
    expect(res.body.code).toBe('invalid_phone');
    expect(mockRequest.execute).not.toHaveBeenCalled();
  });
  it('delegates a six-digit code and returns both fresh tokens', async () => {
    const result = { phone: '+966512345678', tokens: { accessToken: 'access', refreshToken: 'refresh' } };
    mockVerify.execute.mockResolvedValue(result);
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/phone/verify').send({ challengeId, code: '012345' }).expect(200);
    expect(res.body).toEqual(result);
    expect(mockVerify.execute).toHaveBeenCalledWith('client-1', { challengeId, code: '012345' });
  });
  it.each(['1234', '12345x', '1234567', 123456])('rejects malformed code %s', async code => {
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/phone/verify').send({ challengeId, code }).expect(400);
    expect(res.body.code).toBe('invalid_or_expired_code');
    expect(mockVerify.execute).not.toHaveBeenCalled();
  });
  it('rejects non-UUID challenges and injected identities', async () => {
    const res = await request(app.getHttpServer()).post('/mobile/client/profile/phone/verify').send({ challengeId: 'not-uuid', code: '123456', clientId: 'victim' }).expect(400);
    expect(JSON.stringify(res.body)).not.toContain('victim');
    expect(mockVerify.execute).not.toHaveBeenCalled();
  });
});
