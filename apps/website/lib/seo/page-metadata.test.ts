import { describe, it, expect, afterEach, vi } from 'vitest';
import type { PublicBranding } from '@sawaa/shared';

const branding: PublicBranding = {
  organizationNameAr: 'مركز سواء',
  organizationNameEn: 'Sawa Center',
  productTagline: null,
  logoUrl: null,
  faviconUrl: null,
  colorPrimary: null,
  colorPrimaryLight: null,
  colorPrimaryDark: null,
  colorAccent: null,
  colorAccentDark: null,
  colorBackground: null,
  fontFamily: null,
  fontUrl: null,
  timeFormat: '24h',
  contactPhone: null,
  contactEmail: null,
};

describe('buildPageMetadata (lib/seo/page-metadata.ts)', () => {
  // BASE_URL is captured at module load: const BASE_URL = process.env...
  // To exercise the env-driven branch, we re-import the module under a
  // controlled env via vi.resetModules.
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_WEBSITE_URL;
  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    else process.env.NEXT_PUBLIC_WEBSITE_URL = ORIGINAL_ENV;
    vi.resetModules();
  });

  it('builds an AR-localized title that suffixes the site name with em-dash', async () => {
    const { buildPageMetadata } = await import('./page-metadata');
    const m = buildPageMetadata({
      branding,
      path: '/therapists',
      titleAr: 'المعالجون',
      descriptionAr: 'تعرّف على فريقنا',
    });
    expect(m.title).toBe('المعالجون — مركز سواء');
    expect(m.description).toBe('تعرّف على فريقنا');
  });

  it('uses the configured base URL (NEXT_PUBLIC_WEBSITE_URL) for the canonical + openGraph url', async () => {
    process.env.NEXT_PUBLIC_WEBSITE_URL = 'https://example.com';
    vi.resetModules();
    const { buildPageMetadata } = await import('./page-metadata');
    const m = buildPageMetadata({
      branding,
      path: '/contact',
      titleAr: 'تواصل',
      descriptionAr: 'تواصل معنا',
    });
    expect(m.alternates).toEqual({ canonical: 'https://example.com/contact' });
    expect(m.openGraph).toMatchObject({
      type: 'website',
      url: 'https://example.com/contact',
      title: 'تواصل — مركز سواء',
      siteName: 'مركز سواء',
      locale: 'ar_SA',
    });
  });

  it('falls back to https://sawaa.sa when NEXT_PUBLIC_WEBSITE_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_WEBSITE_URL;
    vi.resetModules();
    const { buildPageMetadata } = await import('./page-metadata');
    const m = buildPageMetadata({
      branding,
      path: '/therapists',
      titleAr: 't',
      descriptionAr: 'd',
    });
    expect(m.alternates).toEqual({ canonical: 'https://sawaa.sa/therapists' });
    expect(m.openGraph?.url).toBe('https://sawaa.sa/therapists');
  });

  it('produces a Twitter card with summary_large_image and the same title/description', async () => {
    const { buildPageMetadata } = await import('./page-metadata');
    const m = buildPageMetadata({
      branding,
      path: '/therapists',
      titleAr: 'المعالجون',
      descriptionAr: 'تعرّف على فريقنا',
    });
    expect(m.twitter).toEqual({
      card: 'summary_large_image',
      title: 'المعالجون — مركز سواء',
      description: 'تعرّف على فريقنا',
    });
  });

  it('sets robots to index=true, follow=true (page is always indexable)', async () => {
    const { buildPageMetadata } = await import('./page-metadata');
    const m = buildPageMetadata({
      branding,
      path: '/therapists',
      titleAr: 't',
      descriptionAr: 'd',
    });
    expect(m.robots).toEqual({ index: true, follow: true });
  });
});
