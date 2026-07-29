import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Validates the static security headers in next.config.mjs.
//
// Note: as of the 2.1 change, Content-Security-Policy is now emitted
// PER-REQUEST by middleware.ts (with a nonce + 'strict-dynamic'),
// not statically via this headers() hook. CSP-specific tests moved to
// middleware.test.ts. Here we only verify the static baseline.

async function loadHeaders() {
  // Bust the module cache so env-derived values reflect each test's env.
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

  it('does NOT emit a static CSP — it is per-request via middleware', async () => {
    // CSP is generated per-request in middleware.ts with a nonce.
    // This test prevents accidental reintroduction of a static CSP
    // that would clobber the nonce-based one.
    const headers = await loadHeaders();
    expect(headers.has('Content-Security-Policy')).toBe(false);
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
