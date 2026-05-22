import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function makeRequest(pathname: string, opts: { authed?: boolean } = {}): NextRequest {
  const req = new NextRequest(`http://localhost:5205${pathname}`);
  if (opts.authed) {
    req.cookies.set('client_access_token', 'fake-token');
  }
  return req;
}

describe('middleware', () => {
  describe('unauthenticated user', () => {
    it('redirects /account to /login with redirect query', () => {
      const res = middleware(makeRequest('/account'));
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      const url = new URL(location!);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirect')).toBe('/account');
    });

    it('redirects nested /account/bookings/abc preserving full path in redirect query', () => {
      const res = middleware(makeRequest('/account/bookings/abc'));
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      const url = new URL(location!);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirect')).toBe('/account/bookings/abc');
    });

    it('redirects /booking/confirm to /login with redirect query', () => {
      const res = middleware(makeRequest('/booking/confirm'));
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      const url = new URL(location!);
      expect(url.pathname).toBe('/login');
      expect(url.searchParams.get('redirect')).toBe('/booking/confirm');
    });

    it('passes through non-protected paths without redirect', () => {
      // /therapists is not in PROTECTED_PATHS nor AUTH_PATHS — no redirect headers set
      const res = middleware(makeRequest('/therapists'));
      expect(res.headers.get('location')).toBeNull();
    });
  });

  describe('authenticated user', () => {
    it('redirects /login to /account', () => {
      const res = middleware(makeRequest('/login', { authed: true }));
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      const url = new URL(location!);
      expect(url.pathname).toBe('/account');
    });

    it('redirects /register to /account', () => {
      const res = middleware(makeRequest('/register', { authed: true }));
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      const url = new URL(location!);
      expect(url.pathname).toBe('/account');
    });

    it('does not redirect /account when authenticated', () => {
      const res = middleware(makeRequest('/account', { authed: true }));
      expect(res.headers.get('location')).toBeNull();
    });
  });
});
