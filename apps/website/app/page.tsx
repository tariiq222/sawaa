import { getPublicBrandingForSsr } from '@/features/branding/public';
import { theme } from '@/themes/registry';

export default async function HomePage() {
  await getPublicBrandingForSsr();
  const HomeComponent = theme.pages.home;
  const Layout = theme.Layout;

  return (
    <Layout>
      <HomeComponent />
    </Layout>
  );
}
