import { theme } from '@/themes/registry';

export default function HomePage() {
  const HomeComponent = theme.pages.home;
  const Layout = theme.Layout;

  return (
    <Layout>
      <HomeComponent />
    </Layout>
  );
}
