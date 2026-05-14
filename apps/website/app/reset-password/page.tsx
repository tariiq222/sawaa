import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function ResetPasswordPage() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const ResetPasswordComponent = theme.pages.resetPassword;
  const Layout = theme.Layout;

  return (
    <Layout>
      <ResetPasswordComponent />
    </Layout>
  );
}
