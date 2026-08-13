import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const CSRF_COOKIE = 'ck_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * Browser-side mutations (POST/PUT/PATCH/DELETE) that rely on the client JWT
 * cookie MUST also send an `X-CSRF-Token` header whose value equals the
 * `ck_csrf` cookie. Because cross-origin attackers cannot read the cookie
 * value, they cannot forge the header — breaking the request.
 *
 * Token is generated on the first protected request and kept in a host-only
 * API cookie. The matching response header lets an explicitly CORS-allowed
 * website origin bootstrap the token without widening the cookie Domain.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.cookies?.[CSRF_COOKIE];
  let token: string;

  if (typeof existing !== 'string' || !CSRF_TOKEN_PATTERN.test(existing)) {
    const fresh = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, fresh, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    req.cookies = { ...(req.cookies ?? {}), [CSRF_COOKIE]: fresh };
    token = fresh;
  } else {
    token = existing;
  }

  // CORS exposes this header only to explicitly configured origins. Keeping
  // the token out of URLs and browser storage avoids history/log leakage.
  res.setHeader(CSRF_HEADER, token);

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER];
  const cookieToken = req.cookies?.[CSRF_COOKIE];

  if (
    typeof headerToken !== 'string' ||
    typeof cookieToken !== 'string' ||
    headerToken.length === 0 ||
    headerToken !== cookieToken
  ) {
    res.status(403).json({ statusCode: 403, message: 'CSRF token missing or invalid' });
    return;
  }

  next();
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE;
export const CSRF_HEADER_NAME = CSRF_HEADER;
