import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { SawaaSupportGroupsPage } from '@/themes/sawaa/pages/support-groups';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/support-groups',
    titleAr: 'البرامج الجماعية',
    descriptionAr: 'برامج جماعية منشورة من مركز سواء، بمواعيد ومقاعد واضحة وبإشراف مختصين.',
    titleEn: 'Group Programs',
    descriptionEn: 'Group programs published by Sawaa with clear schedules, capacity, and specialist supervision.',
  });
}

export default function SupportGroupsRoute() {
  const Layout = theme.Layout;
  return (
    <Layout>
      <SawaaSupportGroupsPage />
    </Layout>
  );
}
