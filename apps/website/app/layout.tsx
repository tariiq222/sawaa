import type { Metadata, Viewport } from 'next';
import { BrandingProvider, BrandingStyle, getPublicBrandingForSsr } from '@/features/branding/public';
import { QueryProvider } from '@/providers/query-provider';
import { getLocale, localeDir } from '@/features/locale/locale';
import { LocaleProvider } from '@/features/locale/locale-provider';
import { AnalyticsLoader } from '@/components/analytics/analytics-loader';
import { FloatingWhatsApp } from '@/components/cta/floating-whatsapp';
import './globals.css';
import {
  generateMedicalBusinessSchema,
  generateLocalBusinessSchema,
  generateLocalBusinessJsonLd,
} from '@/lib/seo/schema';

const SITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://sawaa.sa';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const branding = await getPublicBrandingForSsr();
    return {
      title: branding.organizationNameAr,
      description: branding.productTagline ?? 'مركز متخصص في الاستشارات النفسية والأسرية وعلاج الإدمان بسرية تامة وكوادر سعودية مؤهلة.',
      icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
      metadataBase: new URL(SITE_URL),
      openGraph: {
        // Required so Next.js can resolve relative og:url fields to
        // absolute URLs. The branding-driven ogTitle/ogDescription is
        // added per page by buildPageMetadata().
        siteName: branding.organizationNameAr,
        locale: 'ar_SA',
        type: 'website',
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return {
      title: 'مركز سواء للاستشارات الأسرية',
      description: 'مركز متخصص في الاستشارات النفسية والأسرية بسرية تامة وكوادر سعودية مؤهلة',
      metadataBase: new URL(SITE_URL),
    };
  }
}

// In Next 15+ the viewport/themeColor/etc. live in a dedicated export
// so the root <meta name=\"viewport\"> is emitted in <head>.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  colorScheme: 'light',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const branding = await getPublicBrandingForSsr();
  const locale = await getLocale();
  const dir = localeDir(locale);

  const medicalBusinessSchema = generateMedicalBusinessSchema({
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: branding.organizationNameAr,
    description: branding.productTagline ?? undefined,
    url: SITE_URL,
    medicalSpecialty: 'MentalHealth',
  });

  // LocalBusiness gives Google the data needed for the local pack and
  // opening-hours rich results. The address + geo come from the branding
  // contact info; fall back to a stable placeholder until operations
  // adds real values via the branding admin.
  const localBusinessSchema = generateLocalBusinessSchema({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}#organization`,
    name: branding.organizationNameAr,
    description: branding.productTagline ?? undefined,
    url: SITE_URL,
    telephone: branding.contactPhone ?? undefined,
    email: branding.contactEmail ?? undefined,
    image: branding.logoUrl ?? undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Riyadh',
      addressRegion: 'Riyadh Province',
      addressCountry: 'SA',
    },
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        opens: '09:00',
        closes: '21:00',
      },
    ],
  });

  return (
    <html lang={locale} dir={dir}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('sw-js')",
          }}
        />
        <BrandingStyle branding={branding} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: medicalBusinessSchema }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: generateLocalBusinessJsonLd(localBusinessSchema) }}
        />
      </head>
      <body>
        <QueryProvider>
          <LocaleProvider locale={locale}>
            <BrandingProvider branding={branding}>
              {children}
              <AnalyticsLoader />
              <FloatingWhatsApp
                phone={branding.contactPhone ?? ''}
              />
            </BrandingProvider>
          </LocaleProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
