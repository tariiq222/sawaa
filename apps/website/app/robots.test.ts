import { describe, it, expect, afterEach, vi } from 'vitest';

describe('robots (app/robots.ts)', () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_WEBSITE_URL;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    } else {
      process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGINAL_ENV;
    }
    vi.resetModules();
  });

  it('disallows /account/, /api/, and /booking/confirm while allowing /', async () => {
    const { default: robots } = await import('./robots');
    const result = robots();

    expect(result.rules).toEqual([
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/account/', '/api/', '/booking/confirm'],
      },
    ]);
  });

  it('uses default sitemap URL when NEXT_PUBLIC_WEBSITE_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    vi.resetModules();
    const { default: robots } = await import('./robots');
    const result = robots();

    expect(result.sitemap).toBe('https://sawaa.sa/sitemap.xml');
  });

  it('uses configured NEXT_PUBLIC_WEBSITE_URL for sitemap URL', async () => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = 'https://custom-domain.com';
    vi.resetModules();
    const { default: robots } = await import('./robots');
    const result = robots();

    expect(result.sitemap).toBe('https://custom-domain.com/sitemap.xml');
  });
});
