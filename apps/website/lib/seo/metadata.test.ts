import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('buildPageMetadata (lib/seo/metadata.ts)', () => {
  // buildPageMetadata in metadata.ts reads `process.env.NEXT_PUBLIC_WEBSITE_URL`
  // at CALL time, so the env value at module import does not matter — we
  // can mutate it freely per test.
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_WEBSITE_URL;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_WEBSITE_URL;
  });
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    else process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGINAL_ENV;
    vi.resetModules();
  });

  it('returns a Next Metadata object with title + description populated', async () => {
    const { buildPageMetadata } = await import('./metadata');
    const m = buildPageMetadata({
      title: 'Contact',
      description: 'Reach the Sawa center',
    });
    expect(m.title).toBe('Contact');
    expect(m.description).toBe('Reach the Sawa center');
  });

  it('omits alternates.canonical when no canonical is provided', async () => {
    const { buildPageMetadata } = await import('./metadata');
    const m = buildPageMetadata({ title: 't', description: 'd' });
    expect(m.alternates).toBeUndefined();
  });

  it('prepends the configured base URL to the canonical path', async () => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = 'https://example.com';
    const { buildPageMetadata } = await import('./metadata');
    const m = buildPageMetadata({
      title: 't',
      description: 'd',
      canonical: '/contact',
    });
    expect(m.alternates).toEqual({ canonical: 'https://example.com/contact' });
  });

  it('falls back to https://sawaa.sa when NEXT_PUBLIC_WEBSITE_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    const { buildPageMetadata } = await import('./metadata');
    const m = buildPageMetadata({
      title: 't',
      description: 'd',
      canonical: '/therapists',
    });
    expect(m.alternates).toEqual({ canonical: 'https://sawaa.sa/therapists' });
  });

  it('mirrors the title/description/url into openGraph + twitter', async () => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = 'https://example.com';
    const { buildPageMetadata } = await import('./metadata');
    const m = buildPageMetadata({
      title: 'Therapists',
      description: 'Meet our therapists',
      canonical: '/therapists',
      ogImage: '/og.png',
    });
    expect(m.openGraph).toMatchObject({
      type: 'website',
      title: 'Therapists',
      description: 'Meet our therapists',
      url: 'https://example.com/therapists',
    });
    expect(m.openGraph?.images).toEqual([
      { url: 'https://example.com/og.png', width: 1200, height: 630 },
    ]);
    expect(m.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Therapists',
      description: 'Meet our therapists',
    });
    expect(m.twitter?.images).toEqual(['https://example.com/og.png']);
  });

  it('leaves openGraph + twitter images undefined when ogImage is absent', async () => {
    const { buildPageMetadata } = await import('./metadata');
    const m = buildPageMetadata({ title: 't', description: 'd' });
    expect(m.openGraph?.images).toBeUndefined();
    expect(m.twitter?.images).toBeUndefined();
  });

  it('sets robots.noindex=true when noIndex is true; undefined otherwise', async () => {
    const { buildPageMetadata } = await import('./metadata');
    const indexed = buildPageMetadata({ title: 't', description: 'd' });
    expect(indexed.robots).toBeUndefined();

    const noindex = buildPageMetadata({ title: 't', description: 'd', noIndex: true });
    expect(noindex.robots).toEqual({ index: false, follow: false });
  });
});
