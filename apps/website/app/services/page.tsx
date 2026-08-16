import type { Metadata } from 'next';

import { getPublicBrandingForSsr } from '@/features/branding/public';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { theme } from '@/themes/registry';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/services',
    titleAr: 'الخدمات',
    descriptionAr: 'استعرض خدمات مركز سواء المتاحة للحجز، وتعرّف على تفاصيل كل خدمة ومدتها وتكلفتها.',
    titleEn: 'Services',
    descriptionEn:
      'Explore Sawaa services available to book, including each service’s duration and price.',
  });
}

export default function ServicesRoute() {
  const Page = theme.pages.services;
  const Layout = theme.Layout;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
