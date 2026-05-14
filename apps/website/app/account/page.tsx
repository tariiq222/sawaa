import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function AccountPage() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const AccountComponent = theme.pages.account;
  const Layout = theme.Layout;

  return (
    <Layout>
      <AccountComponent />
    </Layout>
  );
}
