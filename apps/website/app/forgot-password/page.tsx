import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function ForgotPasswordPage() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const ForgotPasswordComponent = theme.pages.forgotPassword;
  const Layout = theme.Layout;

  return (
    <Layout>
      <ForgotPasswordComponent />
    </Layout>
  );
}
