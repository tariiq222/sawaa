import type { Metadata } from 'next';
import { BrandingProvider, BrandingStyle, getPublicBrandingForSsr } from '@/features/branding/public';
import './globals.css';
import { generateMedicalBusinessSchema } from '@/lib/seo/schema';

export const dynamic = 'force-dynamic';

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

  const medicalBusinessSchema = generateMedicalBusinessSchema({
    '@context': 'https://schema.org',
    '@type': 'MedicalBusiness',
    name: branding.organizationNameAr,
    description: branding.productTagline ?? undefined,
    url: process.env.NEXT_PUBLIC_WEBSITE_URL,
    medicalSpecialty: 'MentalHealth',
  });

  return (
    <html lang="ar" dir="rtl">
      <head>
        <BrandingStyle branding={branding} />
        {branding.fontUrl ? (
          <link rel="stylesheet" href={branding.fontUrl} />
        ) : (
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
        <BrandingProvider branding={branding}>{children}</BrandingProvider>
      </body>
    </html>
  );
}
