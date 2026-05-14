import { getPublicBrandingForSsr } from '@/features/branding/public';
import { themes } from '@/themes/registry';

export default async function HomePage() {
  const branding = await getPublicBrandingForSsr();
  const theme = themes[branding.activeWebsiteTheme];
  const HomeComponent = theme.pages.home;
  const Layout = theme.Layout;

  return (
    <Layout>
      <HomeComponent />
    </Layout>
  );
}
