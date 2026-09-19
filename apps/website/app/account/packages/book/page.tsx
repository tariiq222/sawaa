import { theme } from '@/themes/registry';

export default async function AccountPackageBookPage({ searchParams }: { searchParams: Promise<{ creditId?: string }> }) {
  const Layout = theme.Layout;
  const query = await searchParams;
  return <Layout><theme.pages.accountPackages creditId={query.creditId} /></Layout>;
}
