import { csrfMiddleware, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf.middleware';

describe('csrfMiddleware', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = { method: 'POST', cookies: {}, headers: {} };
    res = {
      cookie: jest.fn(),
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
  });

  it('reuses an existing valid token', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'a'.repeat(64);
    csrfMiddleware(req, res, next);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('replaces a short (invalid) token', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'short';
    csrfMiddleware(req, res, next);
    expect(res.cookie).toHaveBeenCalledTimes(1);
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
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects POST when cookie and header mismatch', () => {
    req.cookies[CSRF_COOKIE_NAME] = 'a'.repeat(64);
    req.headers[CSRF_HEADER_NAME] = 'b'.repeat(64);
    csrfMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
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
