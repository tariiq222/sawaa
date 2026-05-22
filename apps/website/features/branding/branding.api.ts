import * as Sentry from '@sentry/nextjs';
import type { PublicBranding } from '@sawaa/shared';

import { getApiBase } from '@/lib/api-base';

/** Default branding used when the SSR fetch fails — keeps the page renderable. */
const DEFAULT_BRANDING: PublicBranding = {
  organizationNameAr: 'منظمتي',
  organizationNameEn: null,
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
  websiteDomain: null,
  timeFormat: '24h',
};

export async function getPublicBrandingForSsr(): Promise<PublicBranding> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${getApiBase()}/public/branding`, {
      next: { revalidate: 60, tags: ['branding'] },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!response.ok) {
      Sentry.addBreadcrumb({
        category: 'fetch',
        level: 'warning',
        message: '[branding] fetch failed — using default branding',
        data: { status: response.status },
      });
      return DEFAULT_BRANDING;
    }
    return (await response.json()) as PublicBranding;
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'fetch',
      level: 'warning',
      message: '[branding] fetch error — using default branding',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return DEFAULT_BRANDING;
  }
}
