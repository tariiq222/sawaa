import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/register',
    titleAr: 'إنشاء حساب مستفيد لدى مركز سواء',
    descriptionAr: 'أنشئ حساب مستفيد لدى مركز سواء لحجز جلساتك ومتابعة مواعيدك من أي جهاز.',
  });
}

export default async function RegisterPage() {
  const RegisterComponent = theme.pages.register;
  const Layout = theme.Layout;

  return (
    <Layout>
      <RegisterComponent />
    </Layout>
  );
}
