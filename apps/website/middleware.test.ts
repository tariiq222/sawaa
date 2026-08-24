import { afterEach, describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function makeRequest(pathname: string, opts: { authed?: boolean } = {}): NextRequest {
  const req = new NextRequest(`http://localhost:5205${pathname}`);
  if (opts.authed) {
    req.cookies.set('client_access_token', 'fake-token');
  }
  return req;
}

// Next.js declares process.env.NODE_ENV as readonly in its ambient
// types, so we route writes through Object.assign (which uses the
// index signature and bypasses the readonly-property restriction).
function setNodeEnv(value: 'production' | 'development' | 'test'): void {
  Object.assign(process.env, { NODE_ENV: value });
}
function restoreNodeEnv(value: string | undefined): void {
  if (value === undefined) Object.assign(process.env, { NODE_ENV: undefined });
  else Object.assign(process.env, { NODE_ENV: value });
}

describe('middleware', () => {
  // buildCsp reads process.env.NODE_ENV at call time, so we save and
  // restore it around each test (and around describe blocks) to keep
  // cases independent and to satisfy the "production CSP must NOT
  // contain 'unsafe-eval'" invariant under Vitest's default
  // NODE_ENV='test'.
  const originalNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    restoreNodeEnv(originalNodeEnv);
  });

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
    it('emits a Content-Security-Policy header on every non-redirect response (production CSP, no unsafe-eval)', () => {
      // Production: script-src must NOT contain unsafe-inline or unsafe-eval.
      // (style-src may still have unsafe-inline — that's intentional
      // until we migrate away from <style jsx> usage)
      setNodeEnv('production');
      const res = middleware(makeRequest('/therapists'));
      const csp = res.headers.get('content-security-policy');
      expect(csp).toBeTruthy();
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

  describe('CSP script-src by NODE_ENV', () => {
    // Verifies the dev-only 'unsafe-eval' relaxation introduced so
    // Next.js React Refresh / HMR can evaluate code in development.
    // The production CSP must remain byte-for-byte identical to the
    // pre-relaxation form.

    it('production: script-src has self+nonce+strict-dynamic+FOUC hash and no unsafe-eval', () => {
      setNodeEnv('production');
      const res = middleware(makeRequest('/'));
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toBeTruthy();
      // Match a script-src whose only sources are 'self', a nonce-*, 'strict-dynamic',
      // and the FOUC_SCRIPT_HASH. Asserts the directive is exactly the production
      // form (no 'unsafe-eval', no 'unsafe-inline'). The FOUC hash MUST be present
      // so the inline `document.documentElement.classList.add('sw-js')` script in
      // app/layout.tsx is allowed by CSP without falling back to 'unsafe-inline'.
      const scriptSrcMatch = csp.match(/script-src[^;]*/);
      expect(scriptSrcMatch).not.toBeNull();
      expect(scriptSrcMatch![0]).toMatch(
        /^script-src 'self' 'nonce-[0-9a-f]{16}' 'strict-dynamic' 'sha256-DY\/VAMtBGvhQC\+0XhmB5TxS7gbObQ8KIXwJIZsXsGK4='$/,
      );
      expect(scriptSrcMatch![0]).not.toContain("'unsafe-eval'");
      expect(scriptSrcMatch![0]).not.toContain("'unsafe-inline'");
      expect(scriptSrcMatch![0]).toContain("'sha256-DY/VAMtBGvhQC+0XhmB5TxS7gbObQ8KIXwJIZsXsGK4='");
    });

    it('development: script-src adds unsafe-eval for React Refresh / HMR and keeps the FOUC hash', () => {
      setNodeEnv('development');
      const res = middleware(makeRequest('/'));
      const csp = res.headers.get('content-security-policy') ?? '';
      expect(csp).toBeTruthy();
      const scriptSrcMatch = csp.match(/script-src[^;]*/);
      expect(scriptSrcMatch).not.toBeNull();
      // 'unsafe-eval' must be present, and must be appended to the same
      // self + nonce + strict-dynamic baseline (still no 'unsafe-inline').
      // The FOUC hash must be the trailing source so the inline script
      // emitted by app/layout.tsx is allowed in development too.
      expect(scriptSrcMatch![0]).toMatch(
        /^script-src 'self' 'nonce-[0-9a-f]{16}' 'strict-dynamic' 'unsafe-eval' 'sha256-DY\/VAMtBGvhQC\+0XhmB5TxS7gbObQ8KIXwJIZsXsGK4='$/,
      );
      expect(scriptSrcMatch![0]).toContain("'unsafe-eval'");
      expect(scriptSrcMatch![0]).not.toContain("'unsafe-inline'");
      expect(scriptSrcMatch![0]).toContain("'sha256-DY/VAMtBGvhQC+0XhmB5TxS7gbObQ8KIXwJIZsXsGK4='");
    });

    it('test NODE_ENV (non-production): script-src mirrors development with the FOUC hash', () => {
      // Vitest runs tests with NODE_ENV='test' by default, so the merged
      // buildCsp treats 'test' as non-production and appends 'unsafe-eval'
      // (React Refresh / HMR need it). The FOUC hash must still be present.
      setNodeEnv('test');
      const res = middleware(makeRequest('/'));
      const csp = res.headers.get('content-security-policy') ?? '';
      const scriptSrcMatch = csp.match(/script-src[^;]*/);
      expect(scriptSrcMatch).not.toBeNull();
      expect(scriptSrcMatch![0]).toMatch(
        /^script-src 'self' 'nonce-[0-9a-f]{16}' 'strict-dynamic' 'unsafe-eval' 'sha256-DY\/VAMtBGvhQC\+0XhmB5TxS7gbObQ8KIXwJIZsXsGK4='$/,
      );
      expect(scriptSrcMatch![0]).not.toContain("'unsafe-inline'");
    });

    it('NODE_ENV toggled per-call: production then development produces the right script-src each time', () => {
      // First call as production
      setNodeEnv('production');
      const prodRes = middleware(makeRequest('/'));
      const prodScriptSrc = (prodRes.headers.get('content-security-policy') ?? '').match(/script-src[^;]*/)![0];
      expect(prodScriptSrc).not.toContain("'unsafe-eval'");

      // Then call as development on a fresh request — proves buildCsp
      // reads NODE_ENV at call time, not at module load.
      setNodeEnv('development');
      const devRes = middleware(makeRequest('/'));
      const devScriptSrc = (devRes.headers.get('content-security-policy') ?? '').match(/script-src[^;]*/)![0];
      expect(devScriptSrc).toContain("'unsafe-eval'");
    });
  });
});
