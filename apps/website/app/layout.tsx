import type { Metadata } from 'next';
import { BrandingProvider, BrandingStyle, getPublicBrandingForSsr } from '@/features/branding/public';
import { QueryProvider } from '@/providers/query-provider';
import { getLocale, localeDir } from '@/features/locale/locale';
import { LocaleProvider } from '@/features/locale/locale-provider';
import './globals.css';
import { generateMedicalBusinessSchema } from '@/lib/seo/schema';

const SITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://sawaa.sa';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const branding = await getPublicBrandingForSsr();
    return {
      title: branding.organizationNameAr,
      description: branding.productTagline ?? undefined,
      icons: branding.faviconUrl ? { icon: branding.faviconUrl } : undefined,
    };
  } catch {
    return {
      title: 'مركز سواء للاستشارات الأسرية',
      description: 'مركز متخصص في الاستشارات النفسية والأسرية بسرية تامة وكوادر سعودية مؤهلة',
    };
  }
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

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <BrandingStyle branding={branding} />
        {branding.fontUrl ? (
          <link rel="stylesheet" href={branding.fontUrl} />
        ) : (
          // eslint-disable-next-line @next/next/no-page-custom-font -- dynamic brand font loaded at runtime
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap"
          />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: medicalBusinessSchema }}
        />
      </head>
      <body>
        <QueryProvider>
          <LocaleProvider locale={locale}>
            <BrandingProvider branding={branding}>{children}</BrandingProvider>
          </LocaleProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
