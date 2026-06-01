import type { Metadata } from 'next';
import type { PublicBranding } from '@sawaa/shared';

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://sawaa.sa';

interface PageSeoInput {
  branding: PublicBranding;
  path: string;
  titleAr: string;
  descriptionAr: string;
}

export function buildPageMetadata({
  branding,
  path,
  titleAr,
  descriptionAr,
}: PageSeoInput): Metadata {
  const siteName = branding.organizationNameAr;
  const fullTitle = `${titleAr} — ${siteName}`;
  const url = `${BASE_URL}${path}`;

  return {
    title: fullTitle,
    description: descriptionAr,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: fullTitle,
      description: descriptionAr,
      siteName,
      locale: 'ar_SA',
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: descriptionAr,
    },
    robots: { index: true, follow: true },
  };
}
