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

  describe('CSP nonce', () => {
    it('emits a Content-Security-Policy header on every non-redirect response', () => {
      const res = middleware(makeRequest('/therapists'));
      const csp = res.headers.get('content-security-policy');
      expect(csp).toBeTruthy();
      // script-src must NOT contain unsafe-inline or unsafe-eval
      // (style-src may still have unsafe-inline — that's intentional
      // until we migrate away from <style jsx> usage)
      const scriptSrc = csp!.split(';').find((s) => s.trim().startsWith('script-src')) ?? '';
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      // Nonce must appear as a 16-char hex string prefixed with nonce-
      expect(csp).toMatch(/'nonce-[0-9a-f]{16}'/);
    });

    it('emits a fresh nonce per request', () => {
      const res1 = middleware(makeRequest('/'));
      const res2 = middleware(makeRequest('/'));
      const nonce1 = res1.headers.get('x-nonce');
      const nonce2 = res2.headers.get('x-nonce');
      expect(nonce1).not.toBeNull();
      expect(nonce2).not.toBeNull();
      expect(nonce1).not.toBe(nonce2);
    });

    it('does not set CSP on a redirect response (auth redirects are short-circuited)', () => {
      // Redirects short-circuit before the nonce path runs.
      const res = middleware(makeRequest('/account'));
      expect(res.headers.get('content-security-policy')).toBeNull();
    });

    it("locks default-src to 'self' and frame-ancestors to 'none'", () => {
      const res = middleware(makeRequest('/'));
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toMatch(/default-src 'self'/);
      expect(csp).toMatch(/frame-ancestors 'none'/);
      expect(csp).toMatch(/object-src 'none'/);
      expect(csp).toMatch(/base-uri 'self'/);
      expect(csp).toMatch(/form-action 'self'/);
    });
  });
});
