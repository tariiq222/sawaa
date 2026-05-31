import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { PrivacyPage } from '@/themes/sawaa/components/legal/legal-page';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/privacy',
    titleAr: 'سياسة الخصوصية',
    descriptionAr:
      'كيف يجمع مركز سواء بياناتك الشخصية والصحية الحساسة ويستخدمها ويحميها، وحقوقك بموجب نظام حماية البيانات الشخصية السعودي.',
  });
}

export default function PrivacyRoute() {
  const Layout = theme.Layout;
  return (
    <Layout>
      <PrivacyPage />
    </Layout>
  );
}
