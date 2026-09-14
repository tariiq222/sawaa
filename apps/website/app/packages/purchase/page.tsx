import { theme } from '@/themes/registry';

export default async function PackagePurchasePage({ searchParams }: { searchParams: Promise<{ packageId?: string; packageFamilyId?: string }> }) {
  const query = await searchParams;
  const Layout = theme.Layout;
  return <Layout><theme.pages.packagePurchase packageId={query.packageId ?? ''} packageFamilyId={query.packageFamilyId} /></Layout>;
}
