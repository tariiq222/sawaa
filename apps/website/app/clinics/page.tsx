import type { Metadata } from 'next';

import { getPublicBrandingForSsr } from '@/features/branding/public';
import { buildPageMetadata } from '@/lib/seo/page-metadata';
import { theme } from '@/themes/registry';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/clinics',
    titleAr: 'العيادات',
    descriptionAr: 'تعرّف على عيادات مركز سواء المتخصصة واختر العيادة المناسبة لحجز موعدك.',
    titleEn: 'Clinics',
    descriptionEn: 'Explore Sawaa clinics and choose the right clinic to book your appointment.',
  });
}

export default function ClinicsRoute() {
  const Page = theme.pages.clinics;
  const Layout = theme.Layout;
  return <Layout><Page /></Layout>;
}
