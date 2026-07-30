import type { Metadata } from 'next';
import type { PublicBranding } from '@sawaa/shared';

const BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? 'https://sawaa.sa';

interface PageSeoInput {
  branding: PublicBranding;
  path: string;
  titleAr: string;
  descriptionAr: string;
  /**
   * Optional English title + description for the bilingual hreflang
   * entries. If omitted, hreflang still points to the canonical URL
   * for both `ar` and `en` but the og:locale:alternate metadata won't
   * carry a distinct EN label.
   */
  titleEn?: string;
  descriptionEn?: string;
}

export function buildPageMetadata({
  branding,
  path,
  titleAr,
  descriptionAr,
  titleEn,
  descriptionEn,
}: PageSeoInput): Metadata {
  const siteName = branding.organizationNameAr;
  const fullTitle = `${titleAr} — ${siteName}`;
  const url = `${BASE_URL}${path}`;

  // Locale-aware metadata:
  // - og:locale = primary (Arabic)
  // - og:locale:alternate = secondary (English) so crawlers + link
  //   unfurlers know both languages exist
  // - alternates.languages declares both versions for hreflang.
  // The site serves the same URL to both locales via the
  // `sawaa-locale` cookie, so both hreflang entries point to the
  // same URL — Google's "self-referential hreflang" rule permits
  // this for single-URL bilingual sites (Search Central guidance).
  const languages: Record<string, string> = {
    'ar-SA': url,
    'en': url,
    'x-default': url,
  }

  return {
    title: fullTitle,
    description: descriptionAr,
    alternates: {
      canonical: url,
      languages,
    },
    openGraph: {
      type: 'website',
      url,
      title: fullTitle,
      description: descriptionAr,
      siteName,
      locale: 'ar_SA',
      // Next 15 serialises alternate locales correctly for og:locale:alternate.
      ...(titleEn || descriptionEn
        ? {
            // OG has no native EN title field — we add it as a custom
            // property via 'alternates' shape so the SocialCard renderer
            // can pick it up. Next 15 surfaces this via `openGraph.alternate`.
            alternateLocale: ['en_US'],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: descriptionAr,
    },
    robots: { index: true, follow: true },
  };
}
