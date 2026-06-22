import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';

const CSRF_COOKIE = 'ck_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection using the double-submit cookie pattern.
 *
 * Browser-side mutations (POST/PUT/PATCH/DELETE) that rely on the client JWT
 * cookie MUST also send an `X-CSRF-Token` header whose value equals the
 * `ck_csrf` cookie. Because cross-origin attackers cannot read the cookie
 * value, they cannot forge the header — breaking the request.
 *
 * Token is generated on first request and rotated on every mutation so a
 * stolen token has a short useful lifetime. The cookie is httpOnly:false so
 * the JS layer (or native app) can echo it back in the header.
 */
export function csrfMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existing = req.cookies?.[CSRF_COOKIE];

  if (!existing || typeof existing !== 'string' || existing.length < 32) {
    const fresh = randomBytes(32).toString('hex');
    res.cookie(CSRF_COOKIE, fresh, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
    req.cookies = { ...(req.cookies ?? {}), [CSRF_COOKIE]: fresh };
  }

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
