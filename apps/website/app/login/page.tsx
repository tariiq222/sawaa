import type { Metadata } from 'next';
import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';
import { buildPageMetadata } from '@/lib/seo/page-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getPublicBrandingForSsr();
  return buildPageMetadata({
    branding,
    path: '/login',
    titleAr: 'تسجيل الدخول',
    descriptionAr: 'سجّل دخولك لإدارة مواعيدك ومتابعة جلساتك.',
  });
}

export default async function LoginPage() {
  const LoginComponent = theme.pages.login;
  const Layout = theme.Layout;

  return (
    <Layout>
      <LoginComponent />
    </Layout>
  );
}
