import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Validates the security-header / CSP wiring in next.config.mjs.
// We re-import the module fresh per test so env-derived values (the CSP
// connect-src origin) reflect the env set in each case.
async function loadHeaders() {
  // Bust the module cache so apiOrigin() re-reads process.env.
  vi.resetModules();
  const mod = await import('./next.config.mjs');
  const config = mod.default as { headers: () => Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> };
  const groups = await config.headers();
  const root = groups.find((g) => g.source === '/(.*)');
  if (!root) throw new Error('no catch-all header group');
  const map = new Map(root.headers.map((h) => [h.key, h.value]));
  return map;
}

describe('website security headers', () => {
  const original = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.sawaa.sa/api/v1';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = original;
  });

  it('emits an ENFORCING CSP (blocks violations)', async () => {
    const headers = await loadHeaders();
    expect(headers.has('Content-Security-Policy')).toBe(true);
    // Enforcing replaces the old report-only key.
    expect(headers.has('Content-Security-Policy-Report-Only')).toBe(false);
  });

  it('scopes the CSP sensibly for a Next.js app', async () => {
    const headers = await loadHeaders();
    const csp = headers.get('Content-Security-Policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    // Next.js needs inline styles.
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('allows the API origin derived from NEXT_PUBLIC_API_URL in connect-src', async () => {
    const headers = await loadHeaders();
    const csp = headers.get('Content-Security-Policy')!;
    // Only the origin (no /api/v1 path) belongs in a CSP source.
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://api.sawaa.sa');
    expect(csp).not.toContain('https://api.sawaa.sa/api/v1');
    // Sentry/GlitchTip origin for error reporting.
    expect(csp).toContain('https://errors.webvue.pro');
  });

  it('ships the baseline hardening headers', async () => {
    const headers = await loadHeaders();
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('Permissions-Policy')).toContain('camera=()');
    expect(headers.get('Strict-Transport-Security')).toContain('max-age=');
  });
});
