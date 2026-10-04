import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadRewrites() {
  vi.resetModules();
  const mod = await import('./next.config.mjs');
  const config = mod.default as {
    rewrites: () => Promise<Array<{ source: string; destination: string }>>;
  };
  return config.rewrites();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('website API proxy rewrite', () => {
  it('leaves the API route untouched when no proxy target is configured', async () => {
    vi.stubEnv('WEBSITE_API_PROXY_URL', '');

    await expect(loadRewrites()).resolves.toEqual([]);
  });

  it('proxies only the versioned API path without duplicating its prefix', async () => {
    vi.stubEnv('WEBSITE_API_PROXY_URL', 'http://backend:5100/api/v1///');

    await expect(loadRewrites()).resolves.toEqual([
      {
        source: '/api/v1/:path*',
        destination: 'http://backend:5100/api/v1/:path*',
      },
    ]);
  });

  it('adds the API prefix when given only an internal origin', async () => {
    vi.stubEnv('WEBSITE_API_PROXY_URL', 'http://backend:5100');

    await expect(loadRewrites()).resolves.toEqual([
      {
        source: '/api/v1/:path*',
        destination: 'http://backend:5100/api/v1/:path*',
      },
    ]);
  });

  it('rejects non-HTTP targets', async () => {
    vi.stubEnv('WEBSITE_API_PROXY_URL', 'ftp://backend:5100/api/v1');

    await expect(loadRewrites()).rejects.toThrow(/http/i);
  });
});
