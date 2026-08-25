import { csrfMiddleware, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.middleware';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { configureCors } from '../../cors';

describe('csrfMiddleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = { method: 'POST', cookies: {}, headers: {} };
    res = {
      cookie: jest.fn(),
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('exports the expected cookie/header names', () => {
    expect(CSRF_COOKIE_NAME).toBe('ck_csrf');
    expect(CSRF_HEADER_NAME).toBe('x-csrf-token');
  });

  it('issues a new token on first request', () => {
    csrfMiddleware(req, res, next);
    expect(res.cookie).toHaveBeenCalledTimes(1);
    const [name, value, opts] = res.cookie.mock.calls[0];
    expect(name).toBe('ck_csrf');
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(opts.httpOnly).toBe(false);
    expect(opts.sameSite).toBe('lax');
    expect(req.cookies[CSRF_COOKIE_NAME]).toBe(value);
    expect(res.setHeader).toHaveBeenCalledWith('x-csrf-token', value);
  });

  it('reuses an existing valid token', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'a'.repeat(64);
    csrfMiddleware(req, res, next);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('x-csrf-token', 'a'.repeat(64));
  });

  it('replaces a short (invalid) token', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'short';
    csrfMiddleware(req, res, next);
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('does not reflect a malformed cookie value into the response header', () => {
    const malformed = 'z'.repeat(64);
    req.method = 'GET';
    req.cookies[CSRF_COOKIE_NAME] = malformed;

    csrfMiddleware(req, res, next);

    const [, fresh] = res.cookie.mock.calls[0];
    expect(fresh).toMatch(/^[a-f0-9]{64}$/);
    expect(res.setHeader).toHaveBeenCalledWith('x-csrf-token', fresh);
    expect(res.setHeader).not.toHaveBeenCalledWith('x-csrf-token', malformed);
  });

  it('lets safe methods (GET/HEAD/OPTIONS) through regardless of header', () => {
    req.method = 'GET';
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects POST with no CSRF header', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'a'.repeat(64);
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'CSRF_INVALID',
      message: 'CSRF token missing or invalid',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects POST when cookie and header mismatch', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'a'.repeat(64);
    req.headers[CSRF_HEADER_NAME] = 'b'.repeat(64);
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'CSRF_INVALID',
      message: 'CSRF token missing or invalid',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts POST when cookie and header match', () => {
    const token = 'a'.repeat(64);
    req.cookies[CSRF_COOKIE_NAME] = token;
    req.headers[CSRF_HEADER_NAME] = token;
    csrfMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('CSRF rejection CORS visibility', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    const moduleRef = await Test.createTestingModule({}).compile();
    app = moduleRef.createNestApplication();
    // CORS must run before CSRF can return a 403, otherwise an allowed
    // cross-origin browser cannot recover safely.
    configureCors(app);
    app.use(cookieParser());
    app.use(csrfMiddleware);
    app.getHttpAdapter().getInstance().post('/csrf-probe', (_req: unknown, res: any) => {
      res.status(204).end();
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.NODE_ENV;
  });

  it('keeps CORS headers on a CSRF mismatch for an allowed website origin', async () => {
    const response = await request(app.getHttpServer())
      .post('/csrf-probe')
      .set('Origin', 'http://localhost:5205')
      .set('Cookie', `${CSRF_COOKIE_NAME}=${'a'.repeat(64)}`)
      .expect(403);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5205');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-expose-headers']).toContain('X-CSRF-Token');
    expect(response.body).toMatchObject({ code: 'CSRF_INVALID' });
  });
});
