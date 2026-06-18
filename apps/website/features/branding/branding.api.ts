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
  colorPrimary: '#55CCB0',
  colorPrimaryLight: '#7CD8C2',
  colorPrimaryDark: '#0E4B43',
  colorAccent: '#E7DBC4',
  colorAccentDark: '#CAAF7B',
  colorBackground: '#EAF8F4',
  fontFamily: 'Handicrafts',
  fontUrl: null,
  timeFormat: '24h',
  contactPhone: null,
  contactEmail: null,
};

export async function getPublicBrandingForSsr(): Promise<PublicBranding> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${getApiBase()}/public/branding`, {
      next: { revalidate: 60 },
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
